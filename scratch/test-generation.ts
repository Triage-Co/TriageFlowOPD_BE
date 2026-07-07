import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { GraphGenerationService } from '../src/routes/graph/graph.service';
import { PrismaConfig } from '../src/shared/config/prisma.config';
import { GeoService } from '../src/shared/geo/geo.service';
import { RoomType } from '@prisma/client';

// Helper to convert meter dimensions to degree coordinates (roughly centered on Hanoi)
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

async function main() {
  console.log("Initializing NestJS application context...");
  const app = await NestFactory.createApplicationContext(AppModule);
  const graphService = app.get(GraphGenerationService);
  const prisma = app.get(PrismaConfig);
  const geoService = app.get(GeoService);

  console.log("Cleaning up previous test data...");
  // Clear edges, nodes, doors, rooms, floors, buildings
  await prisma.edge.deleteMany({});
  await prisma.node.deleteMany({});
  await prisma.door.deleteMany({});
  await prisma.physicalRoom.deleteMany({});
  await prisma.floor.deleteMany({});
  await prisma.building.deleteMany({});

  console.log("Creating dummy building and floor...");
  const building = await prisma.building.create({
    data: {
      name: "Test Building",
      addressLabel: "123 Main St",
      totalFloors: 3,
      organizationId: "11111111-1111-1111-1111-111111111111",
    }
  });

  const floor = await prisma.floor.create({
    data: {
      buildingId: building.id,
      floorNumber: 1,
      widthMeters: 10,
      heightMeters: 10,
      scalePixelsPerMeter: 1,
    }
  });

  // Outline is a 10x10 square in meters
  const floorOutlineWKT = toPolygonWKT([[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]);
  await geoService.updateGeom('floor', floor.id, 'outlineGeom', floorOutlineWKT);

  console.log("Creating dummy rooms...");
  // Room 1 on the left (x from 1 to 4, y from 1 to 4)
  const room1 = await prisma.physicalRoom.create({
    data: {
      floorId: floor.id,
      roomCode: "R1",
      roomLabel: "Room 1",
      type: RoomType.CONSULTATION,
    }
  });
  const room1Outline = toPolygonWKT([[1, 1], [1, 4], [4, 4], [4, 1], [1, 1]]);
  const room1Center = toPointWKT(2.5, 2.5);
  await geoService.updateGeom('physical_room', room1.id, 'outlineGeom', room1Outline);
  await geoService.updateGeom('physical_room', room1.id, 'centerGeom', room1Center);

  // Room 2 on the right (x from 6 to 9, y from 1 to 4)
  const room2 = await prisma.physicalRoom.create({
    data: {
      floorId: floor.id,
      roomCode: "R2",
      roomLabel: "Room 2",
      type: RoomType.EXAMINATION,
    }
  });
  const room2Outline = toPolygonWKT([[6, 1], [6, 4], [9, 4], [9, 1], [6, 1]]);
  const room2Center = toPointWKT(7.5, 2.5);
  await geoService.updateGeom('physical_room', room2.id, 'outlineGeom', room2Outline);
  await geoService.updateGeom('physical_room', room2.id, 'centerGeom', room2Center);

  console.log("Creating dummy doors...");
  // Door 1 (midpoint on the boundary of Room 1)
  const door1 = await prisma.door.create({
    data: {
      floorId: floor.id,
      roomAId: room1.id,
      active: true,
    }
  });
  await geoService.updateGeom('door', door1.id, 'positionGeom', toPointWKT(4, 2.5));

  // Door 2 (midpoint on the boundary of Room 2)
  const door2 = await prisma.door.create({
    data: {
      floorId: floor.id,
      roomAId: room2.id,
      active: true,
    }
  });
  await geoService.updateGeom('door', door2.id, 'positionGeom', toPointWKT(6, 2.5));

  console.log("Generating navigation graph...");
  const result = await graphService.generateGraph(floor.id);
  console.log("Generation output stats:", result);

  console.log("Fetching generated graph nodes and edges...");
  const graph = await graphService.getGraph(floor.id);
  console.log("Total nodes found:", graph.nodes.length);
  console.log("Nodes list:", JSON.stringify(graph.nodes, null, 2));
  console.log("Total edges found:", graph.edges.length);
  console.log("Edges list:", JSON.stringify(graph.edges, null, 2));

  await app.close();
}

main().catch(console.error);
