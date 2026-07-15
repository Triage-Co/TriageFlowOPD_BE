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

describe('Navigation API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let geoService: GeoService;

  // Track created entities for manual database cleanup
  let buildingId: string;
  let floorId: string;
  let floor2Id: string;
  let room1Id: string;
  let room2Id: string;
  let room3Id: string;
  let categoryId: string;
  let poiId: string;
  let boundaryId: string;
  let door1Id: string;
  let door2Id: string;

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
    jest.setTimeout(90000);
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
    console.log("Cleaning up Navigation E2E test data...");
    try {
      if (poiId) await prisma.poi.delete({ where: { id: poiId } }).catch(() => {});
      if (boundaryId) await prisma.roomBoundary.delete({ where: { id: boundaryId } }).catch(() => {});
      if (door1Id) await prisma.door.delete({ where: { id: door1Id } }).catch(() => {});
      if (door2Id) await prisma.door.delete({ where: { id: door2Id } }).catch(() => {});
      if (room1Id) await prisma.physicalRoom.delete({ where: { id: room1Id } }).catch(() => {});
      if (room2Id) await prisma.physicalRoom.delete({ where: { id: room2Id } }).catch(() => {});
      if (room3Id) await prisma.physicalRoom.delete({ where: { id: room3Id } }).catch(() => {});
      if (categoryId) await prisma.category.delete({ where: { id: categoryId } }).catch(() => {});
      if (floorId) await prisma.floor.delete({ where: { id: floorId } }).catch(() => {});
      if (floor2Id) {
        await prisma.node.deleteMany({ where: { floorId: floor2Id } }).catch(() => {});
        await prisma.floor.delete({ where: { id: floor2Id } }).catch(() => {});
      }
      if (buildingId) await prisma.building.delete({ where: { id: buildingId } }).catch(() => {});
    } catch (e) {
      console.error("Cleanup error in Navigation E2E spec:", e);
    }
    await app.close();
  });

  describe('Navigation Flow & Caching', () => {
    it('should seed spatial layout for testing', async () => {
      // 1. Category
      const catRes = await prisma.category.create({
        data: { name: 'E2E Nav Category', sortOrder: 1 }
      });
      categoryId = catRes.id;

      // 2. Building
      const bRes = await prisma.building.create({
        data: {
          name: 'Navigation Test Building',
          addressLabel: 'Main Hospital Center',
          totalFloors: 3,
          organizationId: '00000000-0000-0000-0000-111111111111',
        }
      });
      buildingId = bRes.id;

      // 3. Floor
      const fRes = await prisma.floor.create({
        data: {
          buildingId,
          floorNumber: 1,
          widthMeters: 30,
          heightMeters: 30,
          scalePixelsPerMeter: 1,
        }
      });
      floorId = fRes.id;
      const fOutline = toPolygonWKT([[0, 0], [0, 30], [30, 30], [30, 0], [0, 0]]);
      await geoService.updateGeom('floor', floorId, 'outlineGeom', fOutline);

      // 4. Physical Rooms
      const r1 = await prisma.physicalRoom.create({
        data: {
          floorId,
          roomCode: 'NAV-101',
          roomLabel: 'A* Start Room',
          type: RoomType.CONSULTATION,
        }
      });
      room1Id = r1.id;
      await geoService.updateGeom('physical_room', room1Id, 'centerGeom', toPointWKT(3, 3));
      await geoService.updateGeom('physical_room', room1Id, 'outlineGeom', toPolygonWKT([[1, 1], [1, 5], [5, 5], [5, 1], [1, 1]]));

      const r2 = await prisma.physicalRoom.create({
        data: {
          floorId,
          roomCode: 'NAV-102',
          roomLabel: 'A* Target Room',
          type: RoomType.EXAMINATION,
        }
      });
      room2Id = r2.id;
      await geoService.updateGeom('physical_room', room2Id, 'centerGeom', toPointWKT(20, 3));
      await geoService.updateGeom('physical_room', room2Id, 'outlineGeom', toPolygonWKT([[18, 1], [18, 5], [22, 5], [22, 1], [18, 1]]));

      // 5. Room Boundary
      const boundary = await prisma.roomBoundary.create({
        data: {
          roomId: room1Id,
          seqNo: 1,
          boundaryType: 'WALL',
          hasWall: true,
        }
      });
      boundaryId = boundary.id;
      await geoService.updateGeom('room_boundary', boundaryId, 'lineGeom', toLineWKT([[1, 1], [1, 5]]));

      // 6. POI
      const poi = await prisma.poi.create({
        data: {
          roomId: room2Id,
          categoryId,
          name: 'Pathfinding Target POI',
          description: 'Destination office',
        }
      });
      poiId = poi.id;

      // 7. Doors
      const door1 = await prisma.door.create({
        data: { floorId, roomAId: room1Id, active: true },
      });
      door1Id = door1.id;
      await geoService.updateGeom('door', door1Id, 'positionGeom', toPointWKT(5, 3));

      const door2 = await prisma.door.create({
        data: { floorId, roomAId: room2Id, active: true },
      });
      door2Id = door2.id;
      await geoService.updateGeom('door', door2Id, 'positionGeom', toPointWKT(18, 3));
    }, 30000);

    it('should fetch the complete map of the building (GET /navigation/building/:id/map) and cache it', async () => {
      const res = await request(app.getHttpServer())
        .get(`/navigation/building/${buildingId}/map`)
        .set(mockUserHeaders)
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.data.building.id).toBe(buildingId);
      expect(res.body.data.floors[0].widthMeters).toBe(30);

      // Directly modify the floor width in the DB bypassing NestJS update service.
      // This ensures that if caching works, the next request will still return the old width (30).
      await prisma.floor.update({
        where: { id: floorId },
        data: { widthMeters: 99 },
      });

      const resCached = await request(app.getHttpServer())
        .get(`/navigation/building/${buildingId}/map`)
        .set(mockUserHeaders)
        .expect(200);
      
      expect(resCached.body.data.floors[0].widthMeters).toBe(30); // cache hit!
    });

    it('should invalidate building map cache on floor modifications via service API', async () => {
      // Trigger Floor Update through API (which invalidates the cache)
      await request(app.getHttpServer())
        .patch(`/floor/${floorId}`)
        .set(mockAdminHeaders)
        .send({ widthMeters: 35 })
        .expect(200);

      // Verify that the subsequent call fetches the new value (35)
      const resUpdated = await request(app.getHttpServer())
        .get(`/navigation/building/${buildingId}/map`)
        .set(mockUserHeaders)
        .expect(200);
      
      expect(resUpdated.body.data.floors[0].widthMeters).toBe(35); // cache invalidated and updated successfully!
    });

    it('should automatically generate the navigation graph', async () => {
      await request(app.getHttpServer())
        .post(`/graph/${floorId}/generate`)
        .set(mockAdminHeaders)
        .expect(200);
    }, 45000); // 45 seconds timeout

    it('should find path between Room (Start) and POI (Target) using A* (GET /navigation/route)', async () => {
      const res = await request(app.getHttpServer())
        .get('/navigation/route')
        .query({
          startType: 'ROOM',
          startId: room1Id,
          targetType: 'POI',
          targetId: poiId,
        })
        .set(mockUserHeaders)
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.data.totalDistance).toBeGreaterThan(0);
      expect(res.body.data.path.length).toBeGreaterThan(0);

      const path = res.body.data.path;
      // Start node should have roomId metadata
      expect(path[0].metadata.roomId).toBe(room1Id);
      // Target node should have target roomId metadata (POI room)
      expect(path[path.length - 1].metadata.roomId).toBe(room2Id);

      console.log(`E2E Path calculated: Nodes=${path.length}, Distance=${res.body.data.totalDistance}m`);
    });

    it('should return error if start and target points are disconnected', async () => {
      // 1. Create a disconnected floor and room
      const floor2 = await prisma.floor.create({
        data: {
          buildingId,
          floorNumber: 2,
          widthMeters: 30,
          heightMeters: 30,
        }
      });
      floor2Id = floor2.id;
      const fOutline2 = toPolygonWKT([[0, 0], [0, 30], [30, 30], [30, 0], [0, 0]]);
      await geoService.updateGeom('floor', floor2Id, 'outlineGeom', fOutline2);

      const r3 = await prisma.physicalRoom.create({
        data: {
          floorId: floor2Id,
          roomCode: 'NAV-201',
          roomLabel: 'Disconnected Room',
          type: RoomType.CONSULTATION,
        }
      });
      room3Id = r3.id;
      await geoService.updateGeom('physical_room', room3Id, 'centerGeom', toPointWKT(3, 3));
      await geoService.updateGeom('physical_room', room3Id, 'outlineGeom', toPolygonWKT([[1, 1], [1, 5], [5, 5], [5, 1], [1, 1]]));

      // Generate graph for floor 2 (has only 1 room and no door, so it has exactly 1 node and 0 edges)
      await request(app.getHttpServer())
        .post(`/graph/${floor2Id}/generate`)
        .set(mockAdminHeaders)
        .expect(200);

      // Try routing between start (floor 1 room 1) and disconnected (floor 2 room 3)
      const res = await request(app.getHttpServer())
        .get('/navigation/route')
        .query({
          startType: 'ROOM',
          startId: room1Id,
          targetType: 'ROOM',
          targetId: room3Id,
        })
        .set(mockUserHeaders)
        .expect(400); // Disconnected graph throws BadRequest

      expect(res.body.message).toContain('Không tìm thấy đường đi');
    }, 45000);
  });
});
