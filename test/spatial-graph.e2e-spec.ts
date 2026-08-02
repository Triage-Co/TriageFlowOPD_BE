import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { IsAuthGuard } from './../src/shared/guards/is-auth.guard';
import { IsRoleGuard } from './../src/shared/guards/is-role.guard';
import { PrismaService } from './../src/shared/config/prisma.service';
import { GeoService } from './../src/shared/geo/geo.service';
import { RoomType, ConnectorType, NodeType } from '@prisma/client';

// Mock guards that read mock auth details from request headers
@Injectable()
class MockAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const mockUserId = request.headers['x-mock-user-id'];
    const mockRole = request.headers['x-mock-role'] || 'USER';

    if (!mockUserId) {
      throw new UnauthorizedException({
        code: 401,
        status: 'error',
        message: 'Chưa có token trong header.',
      });
    }

    request['user'] = {
      id: mockUserId,
      role: mockRole,
    };
    return true;
  }
}

@Injectable()
class MockAdminGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request['user'];
    return user && user.role === 'ADMIN';
  }
}

describe('Spatial & Graph API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let geoService: GeoService;

  // Track created entities for manual database cleanup
  let buildingId: string;
  let floorId: string;
  let room1Id: string;
  let room2Id: string;
  let categoryId: string;
  let poiId: string;
  let boundaryId: string;
  let door1Id: string;
  let door2Id: string;
  let connectorId: string;

  const mockAdminHeaders = {
    'x-mock-user-id': '00000000-0000-0000-0000-000000000000',
    'x-mock-role': 'ADMIN',
  };

  const mockUserHeaders = {
    'x-mock-user-id': '00000000-0000-0000-0000-000000000001',
    'x-mock-role': 'USER',
  };

  // Hanoi-centered degree helpers
  const latDegreePerMeter = 1.0 / 111139.0;
  const lonDegreePerMeter = 1.0 / 103780.0;
  const baseLon = 105.804817;
  const baseLat = 21.028511;

  const toCoords = (xMeters: number, yMeters: number): [number, number] => {
    const lon = baseLon + xMeters * lonDegreePerMeter;
    const lat = baseLat + yMeters * latDegreePerMeter;
    return [lon, lat];
  };

  const toPointWKT = (x: number, y: number): string => {
    const [lon, lat] = toCoords(x, y);
    return `POINT(${lon} ${lat})`;
  };

  const toPolygonWKT = (coords: [number, number][]): string => {
    const wktPoints = coords.map(([x, y]) => {
      const [lon, lat] = toCoords(x, y);
      return `${lon} ${lat}`;
    });
    return `POLYGON((${wktPoints.join(', ')}))`;
  };

  const toLineWKT = (coords: [number, number][]): string => {
    const wktPoints = coords.map(([x, y]) => {
      const [lon, lat] = toCoords(x, y);
      return `${lon} ${lat}`;
    });
    return `LINESTRING(${wktPoints.join(', ')})`;
  };

  beforeAll(async () => {
    jest.setTimeout(45000);
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(IsAuthGuard)
      .useClass(MockAuthGuard)
      .overrideGuard(IsRoleGuard)
      .useClass(MockAdminGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    geoService = app.get(GeoService);
  });

  afterAll(async () => {
    console.log("Cleaning up E2E test data...");
    try {
      if (connectorId) await prisma.connector.delete({ where: { id: connectorId } }).catch(() => {});
      if (poiId) await prisma.poi.delete({ where: { id: poiId } }).catch(() => {});
      if (boundaryId) await prisma.roomBoundary.delete({ where: { id: boundaryId } }).catch(() => {});
      if (door1Id) await prisma.door.delete({ where: { id: door1Id } }).catch(() => {});
      if (door2Id) await prisma.door.delete({ where: { id: door2Id } }).catch(() => {});
      if (room1Id) await prisma.physicalRoom.delete({ where: { id: room1Id } }).catch(() => {});
      if (room2Id) await prisma.physicalRoom.delete({ where: { id: room2Id } }).catch(() => {});
      if (categoryId) await prisma.category.delete({ where: { id: categoryId } }).catch(() => {});
      if (floorId) await prisma.floor.delete({ where: { id: floorId } }).catch(() => {});
      if (buildingId) await prisma.building.delete({ where: { id: buildingId } }).catch(() => {});
    } catch (e) {
      console.error("Cleanup error in E2E spec:", e);
    }
    await app.close();
  });

  describe('Phase 3: Spatial & Directory CRUD', () => {
    it('should reject POI creation if not admin (Forbidden)', async () => {
      await request(app.getHttpServer())
        .post('/poi')
        .set(mockUserHeaders)
        .send({ name: 'Blocked Room' })
        .expect(403);
    });

    it('should reject Category creation if unauthenticated (Unauthorized)', async () => {
      await request(app.getHttpServer())
        .post('/category')
        .send({ name: 'Consultation' })
        .expect(401);
    });

    it('should create a Category (Admin)', async () => {
      const res = await request(app.getHttpServer())
        .post('/category')
        .set(mockAdminHeaders)
        .send({
          name: 'Consultation Room Category',
          sortOrder: 1,
        })
        .expect(201);

      expect(res.body.status).toBe('success');
      expect(res.body.data.name).toBe('Consultation Room Category');
      categoryId = res.body.data.id;
    });

    it('should create a Building (Admin)', async () => {
      const res = await request(app.getHttpServer())
        .post('/building')
        .set(mockAdminHeaders)
        .send({
          name: 'Main Clinic Building',
          addressLabel: 'Hanoi Medical Hub',
          totalFloors: 5,
          organizationId: '00000000-0000-0000-0000-111111111111',
        })
        .expect(201);

      expect(res.body.status).toBe('success');
      buildingId = res.body.data.id;
    });

    it('should create a Floor with outline geometry (Admin)', async () => {
      const outlineWkt = toPolygonWKT([[0, 0], [0, 20], [20, 20], [20, 0], [0, 0]]);
      const res = await request(app.getHttpServer())
        .post('/floor')
        .set(mockAdminHeaders)
        .send({
          buildingId,
          floorNumber: 1,
          widthMeters: 20,
          heightMeters: 20,
          scalePixelsPerMeter: 1,
          outlineGeom: outlineWkt,
        })
        .expect(201);

      expect(res.body.status).toBe('success');
      expect(res.body.data.outlineGeom).toBeDefined();
      expect(res.body.data.outlineGeom.type).toBe('Polygon');
      floorId = res.body.data.id;
    });

    it('should create Physical Rooms with center and outline geometries (Admin)', async () => {
      const r1Outline = toPolygonWKT([[1, 1], [1, 5], [5, 5], [5, 1], [1, 1]]);
      const r1Center = toPointWKT(3, 3);
      
      const res1 = await request(app.getHttpServer())
        .post('/physical-room')
        .set(mockAdminHeaders)
        .send({
          floorId,
          roomCode: 'CR-101',
          roomLabel: 'Consultation Room 101',
          type: RoomType.CONSULTATION,
          centerGeom: r1Center,
          outlineGeom: r1Outline,
        })
        .expect(201);

      expect(res1.body.status).toBe('success');
      expect(res1.body.data.centerGeom.type).toBe('Point');
      expect(res1.body.data.outlineGeom.type).toBe('Polygon');
      room1Id = res1.body.data.id;

      // Room 2 (x from 10 to 14, y from 1 to 5)
      const r2Outline = toPolygonWKT([[10, 1], [10, 5], [14, 5], [14, 1], [10, 1]]);
      const r2Center = toPointWKT(12, 3);
      
      const res2 = await request(app.getHttpServer())
        .post('/physical-room')
        .set(mockAdminHeaders)
        .send({
          floorId,
          roomCode: 'ER-102',
          roomLabel: 'Examination Room 102',
          type: RoomType.EXAMINATION,
          centerGeom: r2Center,
          outlineGeom: r2Outline,
        })
        .expect(201);

      room2Id = res2.body.data.id;
    });

    it('should create a Room Boundary with line geometry (Admin)', async () => {
      const wallLine = toLineWKT([[1, 1], [1, 5]]);
      const res = await request(app.getHttpServer())
        .post('/room-boundary')
        .set(mockAdminHeaders)
        .send({
          roomId: room1Id,
          seqNo: 1,
          boundaryType: 'WALL',
          lineGeom: wallLine,
          hasWall: true,
        })
        .expect(201);

      expect(res.body.status).toBe('success');
      expect(res.body.data.lineGeom.type).toBe('LineString');
      boundaryId = res.body.data.id;
    });

    it('should create a POI in a Room (Admin)', async () => {
      const res = await request(app.getHttpServer())
        .post('/poi')
        .set(mockAdminHeaders)
        .send({
          roomId: room1Id,
          categoryId,
          name: 'Pediatrics Consultation POI',
          description: 'Primary pediatric doctor office',
        })
        .expect(201);

      expect(res.body.status).toBe('success');
      poiId = res.body.data.id;
    });
  });

  describe('Phase 4: Navigation Graph Generation', () => {
    beforeAll(async () => {
      // Create Doors directly in the database to anchor the graph layout
      const door1 = await prisma.door.create({
        data: {
          floorId,
          roomAId: room1Id,
          active: true,
        },
      });
      await geoService.updateGeom('door', door1.id, 'positionGeom', toPointWKT(5, 3));
      door1Id = door1.id;

      const door2 = await prisma.door.create({
        data: {
          floorId,
          roomAId: room2Id,
          active: true,
        },
      });
      await geoService.updateGeom('door', door2.id, 'positionGeom', toPointWKT(10, 3));
      door2Id = door2.id;
    });

    it('should automatically generate the navigation graph for the floor', async () => {
      const res = await request(app.getHttpServer())
        .post(`/graph/${floorId}/generate`)
        .set(mockAdminHeaders)
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.data.nodesCreated).toBeGreaterThan(0);
      expect(res.body.data.edgesCreated).toBeGreaterThan(0);
      console.log(`E2E Graph Generation Stats: Nodes=${res.body.data.nodesCreated}, Edges=${res.body.data.edgesCreated}`);
    }, 30000);

    it('should retrieve the generated graph (User)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/graph/${floorId}`)
        .set(mockUserHeaders)
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.data.nodes).toBeDefined();
      expect(res.body.data.edges).toBeDefined();

      const nodes = res.body.data.nodes;
      const edges = res.body.data.edges;

      // Verify room entrance nodes exist
      const room1Node = nodes.find((n: any) => n.metadata?.roomId === room1Id);
      const room2Node = nodes.find((n: any) => n.metadata?.roomId === room2Id);
      const door1Node = nodes.find((n: any) => n.metadata?.doorId === door1Id);
      const door2Node = nodes.find((n: any) => n.metadata?.doorId === door2Id);

      expect(room1Node).toBeDefined();
      expect(room2Node).toBeDefined();
      expect(door1Node).toBeDefined();
      expect(door2Node).toBeDefined();

      expect(room1Node.type).toBe('ROOM_ENTRANCE');
      expect(door1Node.type).toBe('ROOM_ENTRANCE');

      // Verify edge connections: room1Node connects to door1Node
      const roomToDoorEdge = edges.find(
        (e: any) => e.fromNodeId === room1Node.id && e.toNodeId === door1Node.id
      );
      expect(roomToDoorEdge).toBeDefined();
      expect(roomToDoorEdge.distance).toBeGreaterThan(0);

      // Verify door node connects to corridor graph
      const doorToCorridorEdge = edges.find(
        (e: any) => e.fromNodeId === door1Node.id && e.toNodeId !== room1Node.id
      );
      expect(doorToCorridorEdge).toBeDefined();
    });

    it('should manually link inter-floor connector nodes', async () => {
      // 1. Manually place Elevator nodes on the floor to simulate connector anchor points
      const elevatorNode = await prisma.node.create({
        data: {
          floorId,
          type: NodeType.ELEVATOR,
        },
      });
      await geoService.updateGeom('node', elevatorNode.id, 'coordsGeom', toPointWKT(18, 18));

      // 2. Create another floor to link to
      const floor2 = await prisma.floor.create({
        data: {
          buildingId,
          floorNumber: 2,
          widthMeters: 20,
          heightMeters: 20,
          scalePixelsPerMeter: 1,
        },
      });
      const floor2Outline = toPolygonWKT([[0, 0], [0, 20], [20, 20], [20, 0], [0, 0]]);
      await geoService.updateGeom('floor', floor2.id, 'outlineGeom', floor2Outline);

      // 3. Create Elevator node on Floor 2
      const elevatorNode2 = await prisma.node.create({
        data: {
          floorId: floor2.id,
          type: NodeType.ELEVATOR,
        },
      });
      await geoService.updateGeom('node', elevatorNode2.id, 'coordsGeom', toPointWKT(18, 18));

      // 4. Create Connector record serving floors 1 and 2
      const connector = await prisma.connector.create({
        data: {
          buildingId,
          type: ConnectorType.ELEVATOR,
          name: 'Main Elevator A',
          servedFloors: [1, 2],
        },
      });
      connectorId = connector.id;

      // 5. Trigger Link Connector API
      const res = await request(app.getHttpServer())
        .post(`/graph/connector/${connector.id}/link`)
        .set(mockAdminHeaders)
        .send({
          coords: [baseLon, baseLat], // coordinates in degrees to trigger closest lookup fallback if needed
        })
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.data.linksCreated).toBe(2); // bidirectional edges

      // 6. Verify elevator edge exists and has Elevator cost penalty
      const verticalEdge = await prisma.edge.findFirst({
        where: {
          fromNodeId: elevatorNode.id,
          toNodeId: elevatorNode2.id,
        },
      });
      expect(verticalEdge).toBeDefined();
      expect(verticalEdge!.isElevator).toBe(true);
      // Cost penalty: 1 floor diff * 4m + 60s elevator penalty = 64m
      expect(verticalEdge!.distance).toBeCloseTo(64, 1);

      // Cleanup Floor 2 elevator node and floor 2
      await prisma.edge.deleteMany({
        where: {
          OR: [
            { fromNodeId: elevatorNode.id },
            { toNodeId: elevatorNode.id },
          ]
        }
      });
      await prisma.node.delete({ where: { id: elevatorNode.id } });
      await prisma.node.delete({ where: { id: elevatorNode2.id } });
      await prisma.floor.delete({ where: { id: floor2.id } });
    }, 30000);
  });
});
