/**
 * generate-graph.ts
 *
 * Standalone script to auto-generate the navigation graph for Floor 2
 * of the OPD building. Mirrors the logic of GraphGenerationService.generateGraph()
 * but uses raw Prisma + pg pool (no NestJS DI), so it can be run standalone.
 *
 * Usage:
 *   npx ts-node prisma/generate-graph.ts
 *
 * Note: Run AFTER OPD-map-1.seed.ts has populated the floor/rooms/doors.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient, NodeType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as turf from '@turf/turf';
import type { Polygon, MultiPolygon } from 'geojson';

// ─── DB Connection ─────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5000,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── Constants matching the seed ──────────────────────────────────────────────
const BUILDING_NAME = 'Tòa G2 – Khoa Khám Bệnh';

// ─── Geo helpers (minimal, matching geo.service.ts) ───────────────────────────
async function updateGeom(table: string, id: string, column: string, wkt: string) {
  await (prisma as any).$queryRawUnsafe(
    `UPDATE "${table}" SET "${column}" = ST_GeomFromText($1, 4326) WHERE id = $2::uuid`,
    wkt,
    id,
  );
}

async function readGeom(table: string, id: string, column: string): Promise<any | null> {
  const result = (await (prisma as any).$queryRawUnsafe(
    `SELECT ST_AsGeoJSON("${column}") AS geom FROM "${table}" WHERE id = $1::uuid`,
    id,
  )) as any[];
  if (!result || result.length === 0 || !result[0] || typeof result[0].geom !== 'string') {
    return null;
  }
  return JSON.parse(result[0].geom);
}

async function readAllGeoms(table: string, floorId: string, column: string): Promise<any[]> {
  const idColumn = table === 'floor' ? 'id' : 'floorId';
  const result = (await (prisma as any).$queryRawUnsafe(
    `SELECT *, ST_AsGeoJSON("${column}") AS geom FROM "${table}" WHERE "${idColumn}" = $1::uuid`,
    floorId,
  )) as any[];
  return result.map((row: any) => {
    const geom = row.geom ? JSON.parse(row.geom) : null;
    const { [column]: _, geom: __, ...properties } = row;
    return { type: 'Feature', geometry: geom, properties };
  });
}

// ─── Node creation helper ─────────────────────────────────────────────────────
async function createNode(
  floorId: string,
  type: NodeType,
  coords: [number, number],
  metadata?: object,
) {
  const node = await prisma.node.create({
    data: { floorId, type, metadata },
  });
  const wkt = `POINT(${coords[0]} ${coords[1]})`;
  await updateGeom('node', node.id, 'coordsGeom', wkt);
  return node;
}

// ─── Main: Generate Graph ─────────────────────────────────────────────────────
async function generateGraph(floorId: string) {
  const startTime = Date.now();
  console.log(`\n🔧 Generating navigation graph for Floor ID: ${floorId}...`);

  // Load floor outline
  const floorOutlineGeoJSON = await readGeom('floor', floorId, 'outlineGeom');
  if (!floorOutlineGeoJSON) {
    throw new Error('Floor has no outline geometry defined');
  }

  // Clear previous nodes (cascade deletes edges)
  const deleted = await prisma.node.deleteMany({ where: { floorId } });
  console.log(`🗑️  Cleared ${deleted.count} previous nodes`);

  // ── Step 1: Create ROOM_ENTRANCE nodes (one per room) ──────────────────────
  const roomFeatures = await readAllGeoms('physical_room', floorId, 'outlineGeom');
  const roomNodeMap = new Map<string, string>();   // roomId -> nodeId
  const roomCoordsMap = new Map<string, [number, number]>();  // roomId -> coords

  for (const roomFeature of roomFeatures) {
    const poly = roomFeature.geometry;
    if (!poly || (poly.type !== 'Polygon' && poly.type !== 'MultiPolygon')) continue;

    const centroid = turf.centroid(poly);
    let coords = centroid.geometry.coordinates as [number, number];

    if (poly.type === 'Polygon') {
      const isInside = turf.booleanPointInPolygon(centroid, poly);
      if (!isInside) {
        const pointOnFeature = turf.pointOnFeature(poly);
        coords = pointOnFeature.geometry.coordinates as [number, number];
      }
    }

    const roomId = roomFeature.properties.id;
    const node = await createNode(floorId, NodeType.ROOM_ENTRANCE, coords, { roomId });
    roomNodeMap.set(roomId, node.id);
    roomCoordsMap.set(roomId, coords);
  }
  console.log(`🏠 Created ${roomNodeMap.size} room entrance nodes`);

  // ── Step 2: Create ROOM_ENTRANCE nodes for Doors ──────────────────────────
  const doorFeatures = await readAllGeoms('door', floorId, 'positionGeom');
  const activeDoorFeatures = doorFeatures.filter((df) => df.properties.active !== false);
  const doorNodeCoordsMap = new Map<string, [number, number]>(); // nodeId -> coords

  for (const doorFeature of activeDoorFeatures) {
    const geo = doorFeature.geometry;
    let coords: [number, number] | null = null;

    if (geo && geo.type === 'Point') {
      coords = geo.coordinates as [number, number];
    } else {
      const roomAId = doorFeature.properties.roomAId;
      const roomBId = doorFeature.properties.roomBId;
      if (roomAId && roomBId) {
        const cA = roomCoordsMap.get(roomAId);
        const cB = roomCoordsMap.get(roomBId);
        if (cA && cB) {
          const mid = turf.midpoint(turf.point(cA), turf.point(cB));
          coords = mid.geometry.coordinates as [number, number];
        }
      }
      if (!coords && roomAId) coords = roomCoordsMap.get(roomAId) || null;
      if (!coords && roomBId) coords = roomCoordsMap.get(roomBId) || null;
    }

    if (!coords) {
      const fallback = turf.centroid(floorOutlineGeoJSON);
      coords = fallback.geometry.coordinates as [number, number];
    }

    const doorId = doorFeature.properties.id;
    const node = await createNode(floorId, NodeType.ROOM_ENTRANCE, coords, { doorId });
    await prisma.door.update({ where: { id: doorId }, data: { nodeId: node.id } });
    doorNodeCoordsMap.set(node.id, coords);
  }
  console.log(`🚪 Created ${activeDoorFeatures.length} door nodes`);

  // ── Step 3: Build Walkable Polygon (Padded Room BBox minus rooms) ─────────
  const roomPolygons = roomFeatures
    .map((rf) => rf.geometry)
    .filter((g) => g && (g.type === 'Polygon' || g.type === 'MultiPolygon'))
    .map((g) => turf.feature(g as Polygon | MultiPolygon));

  let roomUnion: any = null;
  let walkable: any = floorOutlineGeoJSON;

  if (roomPolygons.length > 0) {
    roomUnion = roomPolygons[0];
    if (roomPolygons.length > 1) {
      roomUnion = turf.union(turf.featureCollection(roomPolygons));
    }

    // Tight bounding box around all rooms, padded by 3.5 meters for outer corridor
    const rBbox = turf.bbox(roomUnion);
    const paddedBbox: [number, number, number, number] = [
      rBbox[0] - 3.5,
      rBbox[1] - 3.5,
      rBbox[2] + 3.5,
      rBbox[3] + 3.5,
    ];
    const corridorBox = turf.bboxPolygon(paddedBbox);

    const diff = turf.difference(
      turf.featureCollection([corridorBox as any, roomUnion as any]),
    );
    if (diff) {
      walkable = diff.geometry;
    }
  }

  // ── Step 4: Voronoi Medial Axis Skeleton ──────────────────────────────────
  const exploded = turf.explode(walkable);
  const uniquePointsMap = new Map<string, any>();
  for (const feature of exploded.features) {
    const c = feature.geometry.coordinates;
    const key = `${c[0].toFixed(6)}_${c[1].toFixed(6)}`;
    uniquePointsMap.set(key, feature);
  }
  const uniquePoints = Array.from(uniquePointsMap.values());
  console.log(`📍 Voronoi seed points: ${uniquePoints.length}`);

  const bbox = turf.bbox(walkable);
  const voronoiPolygons = turf.voronoi(turf.featureCollection(uniquePoints), { bbox });

  const voronoiEdges: [[number, number], [number, number]][] = [];
  const seenEdges = new Set<string>();
  for (const cell of voronoiPolygons.features) {
    if (!cell || cell.geometry.type !== 'Polygon') continue;
    const ring = cell.geometry.coordinates[0];
    for (let i = 0; i < ring.length - 1; i++) {
      const p1 = ring[i] as [number, number];
      const p2 = ring[i + 1] as [number, number];
      const k1 = `${p1[0].toFixed(6)}_${p1[1].toFixed(6)}`;
      const k2 = `${p2[0].toFixed(6)}_${p2[1].toFixed(6)}`;
      if (k1 === k2) continue;
      const edgeKey = [k1, k2].sort().join('||');
      if (seenEdges.has(edgeKey)) continue;
      seenEdges.add(edgeKey);
      voronoiEdges.push([p1, p2]);
    }
  }

  // ── Step 5: Filter to walkable centerline edges ───────────────────────────
  const isInsideWalkable = (coord: [number, number]) => {
    const pt = turf.point(coord);
    if (!turf.booleanPointInPolygon(pt, walkable)) return false;
    for (const roomPoly of roomPolygons) {
      if (turf.booleanPointInPolygon(pt, roomPoly)) return false;
    }
    return true;
  };

  const hasLineOfSight = (p1: [number, number], p2: [number, number]) => {
    const dist = turf.distance(turf.point(p1), turf.point(p2), { units: 'meters' });
    if (dist > 8.0) return false;

    const line = turf.lineString([p1, p2]);
    for (const roomPoly of roomPolygons) {
      const intersects = turf.lineIntersect(line, roomPoly);
      if (intersects.features.length > 0) return false;
      const mid = turf.midpoint(turf.point(p1), turf.point(p2));
      if (turf.booleanPointInPolygon(mid, roomPoly)) return false;
    }
    return true;
  };

  const centerlineEdges: [[number, number], [number, number]][] = [];
  for (const [p1, p2] of voronoiEdges) {
    const pt1 = turf.point(p1);
    const pt2 = turf.point(p2);
    const midCoord = turf.midpoint(pt1, pt2).geometry.coordinates as [number, number];
    if (!isInsideWalkable(p1) || !isInsideWalkable(p2) || !isInsideWalkable(midCoord)) continue;
    if (!hasLineOfSight(p1, p2)) continue;

    let tooClose = false;
    for (const boundaryPt of uniquePoints) {
      if (turf.distance(pt1, boundaryPt, { units: 'meters' }) < 0.4 ||
          turf.distance(pt2, boundaryPt, { units: 'meters' }) < 0.4) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) centerlineEdges.push([p1, p2]);
  }
  console.log(`📐 Centerline edges: ${centerlineEdges.length}`);

  // ── Step 6: Build vertex adjacency, classify JUNCTION vs CORRIDOR ─────────
  const vertexAdjacency = new Map<string, Set<string>>();
  const keyToCoords = new Map<string, [number, number]>();
  const getVertexKey = (p: [number, number]) => `${p[0].toFixed(6)}_${p[1].toFixed(6)}`;

  for (const [p1, p2] of centerlineEdges) {
    const k1 = getVertexKey(p1);
    const k2 = getVertexKey(p2);
    keyToCoords.set(k1, p1);
    keyToCoords.set(k2, p2);
    if (!vertexAdjacency.has(k1)) vertexAdjacency.set(k1, new Set());
    if (!vertexAdjacency.has(k2)) vertexAdjacency.set(k2, new Set());
    vertexAdjacency.get(k1)!.add(k2);
    vertexAdjacency.get(k2)!.add(k1);
  }

  const junctionKeys = new Set<string>();
  for (const [key, neighbors] of vertexAdjacency) {
    if (neighbors.size >= 3) junctionKeys.add(key);
  }

  // ── Step 7: Persist corridor and junction nodes ────────────────────────────
  const nodeMap = new Map<string, string>();             // key -> nodeId
  const nodeCoordsMap = new Map<string, [number, number]>(); // nodeId -> coords
  const createdNodeTypesMap = new Map<string, NodeType>();    // nodeId -> type

  for (const [key, coords] of keyToCoords.entries()) {
    const type = junctionKeys.has(key) ? NodeType.JUNCTION : NodeType.CORRIDOR;
    const node = await createNode(floorId, type, coords);
    nodeMap.set(key, node.id);
    nodeCoordsMap.set(node.id, coords);
    createdNodeTypesMap.set(node.id, type);
  }
  console.log(`🛣️  Created ${nodeMap.size} corridor/junction nodes`);

  // ── Step 8: Build corridor connections (with 3m step sampling) ────────────
  const corridorConnections: [string, string][] = [];
  for (const [p1, p2] of centerlineEdges) {
    const k1 = getVertexKey(p1);
    const k2 = getVertexKey(p2);
    const startNodeId = nodeMap.get(k1)!;
    const endNodeId = nodeMap.get(k2)!;
    const line = turf.lineString([p1, p2]);
    const length = turf.length(line, { units: 'meters' });
    let previousNodeId = startNodeId;
    const stepCount = Math.floor(length / 3.0);
    for (let step = 1; step <= stepCount; step++) {
      const distanceAlong = step * 3.0;
      if (distanceAlong < length - 0.5) {
        const sample = turf.along(line, distanceAlong, { units: 'meters' });
        const sampleCoords = sample.geometry.coordinates as [number, number];
        const sampleKey = getVertexKey(sampleCoords);
        let sampleNodeId = nodeMap.get(sampleKey);
        if (!sampleNodeId) {
          const sampleNode = await createNode(floorId, NodeType.CORRIDOR, sampleCoords);
          sampleNodeId = sampleNode.id;
          nodeMap.set(sampleKey, sampleNodeId);
          nodeCoordsMap.set(sampleNodeId, sampleCoords);
          createdNodeTypesMap.set(sampleNodeId, NodeType.CORRIDOR);
        }
        corridorConnections.push([previousNodeId, sampleNodeId]);
        previousNodeId = sampleNodeId;
      }
    }
    corridorConnections.push([previousNodeId, endNodeId]);
  }

  // ── Step 9: Accumulate edges, connect door nodes ───────────────────────────
  const edgesToCreate: { fromNodeId: string; toNodeId: string; distance: number }[] = [];
  const uniqueEdges = new Set<string>();

  for (const [fromNodeId, toNodeId] of corridorConnections) {
    const edgeKey = [fromNodeId, toNodeId].sort().join('||');
    if (uniqueEdges.has(edgeKey)) continue;
    uniqueEdges.add(edgeKey);
    const cA = nodeCoordsMap.get(fromNodeId)!;
    const cB = nodeCoordsMap.get(toNodeId)!;
    const distance = turf.distance(turf.point(cA), turf.point(cB), { units: 'meters' });
    edgesToCreate.push({ fromNodeId, toNodeId, distance }, { fromNodeId: toNodeId, toNodeId: fromNodeId, distance });
  }

  // Connect door nodes to nearest corridor (with line of sight check)
  const doors = await prisma.door.findMany({ where: { floorId, active: true } });
  for (const door of doors) {
    const doorNodeId = door.nodeId;
    if (!doorNodeId) continue;
    const doorCoords = doorNodeCoordsMap.get(doorNodeId);
    if (!doorCoords) continue;

    let nearestCorridorId: string | null = null;
    let minDist = Infinity;
    for (const [cNodeId, cCoords] of nodeCoordsMap.entries()) {
      const type = createdNodeTypesMap.get(cNodeId);
      if (type !== NodeType.CORRIDOR && type !== NodeType.JUNCTION) continue;
      
      // Verify straight line of sight to door
      if (!hasLineOfSight(doorCoords, cCoords)) continue;

      const dist = turf.distance(turf.point(doorCoords), turf.point(cCoords), { units: 'meters' });
      if (dist < minDist) { minDist = dist; nearestCorridorId = cNodeId; }
    }

    if (nearestCorridorId) {
      edgesToCreate.push(
        { fromNodeId: doorNodeId, toNodeId: nearestCorridorId, distance: minDist },
        { fromNodeId: nearestCorridorId, toNodeId: doorNodeId, distance: minDist },
      );
    }
  }

  // ── Step 10: Persist all edges ─────────────────────────────────────────────
  if (edgesToCreate.length > 0) {
    await prisma.edge.createMany({ data: edgesToCreate, skipDuplicates: true });
  }

  const totalNodes = await prisma.node.count({ where: { floorId } });
  const totalEdges = await prisma.edge.count({ where: { fromNode: { floorId } } });
  const durationMs = Date.now() - startTime;

  console.log('\n============================================================');
  console.log(`✅  Graph generation complete in ${durationMs}ms`);
  console.log(`   Nodes: ${totalNodes}`);
  console.log(`   Edges: ${totalEdges}`);
  console.log('============================================================\n');

  return { totalNodes, totalEdges, durationMs };
}

// ─── Entry point ───────────────────────────────────────────────────────────────
async function main() {
  // Find the building and floor created by the seed
  const building = await prisma.building.findFirst({
    where: { name: BUILDING_NAME },
  });
  if (!building) {
    throw new Error(`Building "${BUILDING_NAME}" not found. Please run the seed first.`);
  }

  const floor = await prisma.floor.findUnique({
    where: { buildingId_floorNumber: { buildingId: building.id, floorNumber: 2 } },
  });
  if (!floor) {
    throw new Error(`Floor 2 of building "${BUILDING_NAME}" not found. Please run the seed first.`);
  }

  console.log(`🏢 Building: ${building.name} (${building.id})`);
  console.log(`📐 Floor 2: ${floor.id}`);

  await generateGraph(floor.id);
}

main()
  .catch((e) => {
    console.error('❌ Graph generation failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
