import { PrismaClient, NodeType } from '@prisma/client';
import * as turf from '@turf/turf';
import { Polygon, MultiPolygon } from 'geojson';
import { readAllGeoms } from './utils';

interface BBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function getBBox(coords: [number, number][]): BBox {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of coords) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, maxX, minY, maxY };
}

function intersectsBBox(b1: BBox, b2: BBox): boolean {
  return !(
    b1.maxX < b2.minX ||
    b1.minX > b2.maxX ||
    b1.maxY < b2.minY ||
    b1.minY > b2.maxY
  );
}

interface CorridorData {
  walkable: any;
  roomPolygons: any[];
  wallBoundaries?: any[];
  centerlineEdges: [[number, number], [number, number]][];
  nodeMap: Map<string, string>;
  nodeCoordsMap: Map<string, [number, number]>;
  createdNodeTypesMap: Map<string, NodeType>;
  voronoiCellsMap?: Map<string, any>;
}

export async function generateGraphEdges(
  prisma: PrismaClient,
  floorId: string,
  doorNodeCoordsMap: Map<string, [number, number]>,
  corridorData: CorridorData,
) {
  console.log(`🔗 Constructing graph edge connections...`);

  const {
    roomPolygons = [],
    wallBoundaries = [],
    centerlineEdges,
    nodeMap,
    nodeCoordsMap,
    createdNodeTypesMap,
    voronoiCellsMap = new Map<string, any>(),
  } = corridorData;

  const roomBBoxes = roomPolygons.map((room) => {
    const coords = turf.coordAll(room) as [number, number][];
    return {
      feature: room,
      bbox: getBBox(coords),
      id: room.properties?.id,
    };
  });

  const wallBBoxes = wallBoundaries.map((wall) => {
    const coords = turf.coordAll(wall) as [number, number][];
    return {
      feature: wall,
      bbox: getBBox(coords),
    };
  });

  const getVertexKey = (p: [number, number]) =>
    `${p[0].toFixed(6)}_${p[1].toFixed(6)}`;

  // 1. Build corridor connections directly from Voronoi centerline edges (no 3m step sampling)
  const corridorConnections: [string, string][] = [];

  for (const [p1, p2] of centerlineEdges) {
    const k1 = getVertexKey(p1);
    const k2 = getVertexKey(p2);
    const startNodeId = nodeMap.get(k1);
    const endNodeId = nodeMap.get(k2);
    if (startNodeId && endNodeId && startNodeId !== endNodeId) {
      corridorConnections.push([startNodeId, endNodeId]);
    }
  }

  // 2. Accumulate edges
  const edgesToCreate: {
    fromNodeId: string;
    toNodeId: string;
    distance: number;
  }[] = [];
  const uniqueEdges = new Set<string>();

  const addBidirectionalEdge = (n1: string, n2: string, dist: number) => {
    const edgeKey = [n1, n2].sort().join('||');
    if (uniqueEdges.has(edgeKey)) return;
    uniqueEdges.add(edgeKey);
    edgesToCreate.push(
      { fromNodeId: n1, toNodeId: n2, distance: dist },
      { fromNodeId: n2, toNodeId: n1, distance: dist },
    );
  };

  for (const [fromNodeId, toNodeId] of corridorConnections) {
    const cA = nodeCoordsMap.get(fromNodeId)!;
    const cB = nodeCoordsMap.get(toNodeId)!;
    const distance = turf.distance(turf.point(cA), turf.point(cB), {
      units: 'meters',
    });
    addBidirectionalEdge(fromNodeId, toNodeId, distance);
  }

  // Helper: Line-of-sight collision check for door to corridor node
  const hasCleanLineOfSightToDoor = (
    p1: [number, number], // doorCoords
    p2: [number, number], // cCoords
    roomAId?: string | null,
    roomBId?: string | null,
  ): boolean => {
    const dist = turf.distance(turf.point(p1), turf.point(p2), {
      units: 'meters',
    });
    if (dist > 25.0) return false;

    const line = turf.lineString([p1, p2]);
    const lineBBox = getBBox([p1, p2]);
    const pt1 = turf.point(p1);
    const pt2 = turf.point(p2);

    // A. Check room polygon collision (excluding door's own rooms)
    for (const roomItem of roomBBoxes) {
      if (roomItem.id && (roomItem.id === roomAId || roomItem.id === roomBId)) {
        continue;
      }
      if (intersectsBBox(lineBBox, roomItem.bbox)) {
        const intersects = turf.lineIntersect(line, roomItem.feature);
        const realIntersects = intersects.features.filter((f) => {
          const dStart = turf.distance(pt1, f, { units: 'meters' });
          const dEnd = turf.distance(pt2, f, { units: 'meters' });
          return dStart > 0.15 && dEnd > 0.15;
        });

        if (realIntersects.length > 0) return false;

        const mid = turf.midpoint(pt1, pt2);
        if (turf.booleanPointInPolygon(mid, roomItem.feature)) return false;
      }
    }

    // B. Check wall boundary collision (excluding points right at the door endpoint)
    for (const wallItem of wallBBoxes) {
      if (intersectsBBox(lineBBox, wallItem.bbox)) {
        const intersects = turf.lineIntersect(line, wallItem.feature);
        const realIntersects = intersects.features.filter((f) => {
          const dStart = turf.distance(pt1, f, { units: 'meters' });
          const dEnd = turf.distance(pt2, f, { units: 'meters' });
          return dStart > 0.35 && dEnd > 0.15;
        });

        if (realIntersects.length > 0) return false;
      }
    }

    return true;
  };

  // 3. Connect door nodes to Corridor/Junction nodes on BOTH SIDES of area/room boundary walls (Dual-Sided Door Connection)
  const doors = await prisma.door.findMany({
    where: { floorId, active: true },
  });
  for (const door of doors) {
    const doorNodeId = door.nodeId;
    if (!doorNodeId) continue;
    const doorCoords = doorNodeCoordsMap.get(doorNodeId);
    if (!doorCoords) continue;

    const dPt = turf.point(doorCoords);

    // Collect all candidate corridor/junction nodes with clean line of sight to door
    const candidateNodes: {
      nodeId: string;
      coords: [number, number];
      dist: number;
    }[] = [];
    for (const [cNodeId, cCoords] of nodeCoordsMap.entries()) {
      const type = createdNodeTypesMap.get(cNodeId);
      if (type !== NodeType.CORRIDOR && type !== NodeType.JUNCTION) continue;

      if (
        hasCleanLineOfSightToDoor(
          doorCoords,
          cCoords,
          door.roomAId,
          door.roomBId,
        )
      ) {
        const dist = turf.distance(dPt, turf.point(cCoords), {
          units: 'meters',
        });
        candidateNodes.push({ nodeId: cNodeId, coords: cCoords, dist });
      }
    }

    candidateNodes.sort((a, b) => a.dist - b.dist);

    if (candidateNodes.length === 0) {
      // Fallback: If no candidate with strict line of sight, pick closest corridor node by distance
      let fallbackId: string | null = null;
      let minDist = Infinity;
      for (const [cNodeId, cCoords] of nodeCoordsMap.entries()) {
        const type = createdNodeTypesMap.get(cNodeId);
        if (type !== NodeType.CORRIDOR && type !== NodeType.JUNCTION) continue;
        const dist = turf.distance(dPt, turf.point(cCoords), {
          units: 'meters',
        });
        if (dist < minDist) {
          minDist = dist;
          fallbackId = cNodeId;
        }
      }
      if (fallbackId) {
        addBidirectionalEdge(doorNodeId, fallbackId, minDist);
      }
      continue;
    }

    // Side A (Primary Connection): Closest candidate node with clean line of sight
    const primaryCandidate = candidateNodes[0];
    addBidirectionalEdge(
      doorNodeId,
      primaryCandidate.nodeId,
      primaryCandidate.dist,
    );

    // Side B (Secondary Connection on Opposite Side of Door Wall):
    // Find candidate node whose direction vector from door forms dot product <= 0 (opposite side)
    const vecA = [
      primaryCandidate.coords[0] - doorCoords[0],
      primaryCandidate.coords[1] - doorCoords[1],
    ];

    let secondaryCandidate: (typeof candidateNodes)[0] | null = null;
    for (let i = 1; i < candidateNodes.length; i++) {
      const cand = candidateNodes[i];
      const vecCand = [
        cand.coords[0] - doorCoords[0],
        cand.coords[1] - doorCoords[1],
      ];
      const dotProduct = vecA[0] * vecCand[0] + vecA[1] * vecCand[1];

      // Negative or zero dot product indicates node lies on opposite or perpendicular side of door
      if (dotProduct <= 0) {
        secondaryCandidate = cand;
        break;
      }
    }

    // If no opposite candidate found by vector dot product, pick second closest candidate if > 1.5m away from primary
    if (!secondaryCandidate && candidateNodes.length > 1) {
      for (let i = 1; i < candidateNodes.length; i++) {
        const cand = candidateNodes[i];
        const distToPrimary = turf.distance(
          turf.point(cand.coords),
          turf.point(primaryCandidate.coords),
          { units: 'meters' },
        );
        if (distToPrimary > 1.5) {
          secondaryCandidate = cand;
          break;
        }
      }
    }

    if (secondaryCandidate) {
      addBidirectionalEdge(
        doorNodeId,
        secondaryCandidate.nodeId,
        secondaryCandidate.dist,
      );
    }
  }

  // 4. Save all edges in database
  if (edgesToCreate.length > 0) {
    await prisma.edge.createMany({ data: edgesToCreate, skipDuplicates: true });
    console.log(
      `🛣️  Persisted ${edgesToCreate.length} directed edges (including bidirectional pairs)`,
    );
  } else {
    console.log(`⚠️ No edges were generated to persist.`);
  }

  return { totalEdges: edgesToCreate.length };
}

type RoomBBox = {
  feature: any;
  bbox: BBox;
  id?: string;
};

type WallBBox = {
  feature: any;
  bbox: BBox;
};

function hasCleanLineOfSight(
  p1: [number, number],
  p2: [number, number],
  roomBBoxes: RoomBBox[],
  wallBBoxes: WallBBox[],
  options?: {
    maxDistMeters?: number;
    skipRoomIds?: Array<string | null | undefined>;
  },
): boolean {
  const maxDist = options?.maxDistMeters ?? 25;
  const dist = turf.distance(turf.point(p1), turf.point(p2), {
    units: 'meters',
  });
  if (dist > maxDist) return false;

  const line = turf.lineString([p1, p2]);
  const lineBBox = getBBox([p1, p2]);
  const pt1 = turf.point(p1);
  const pt2 = turf.point(p2);
  const skip = new Set(
    (options?.skipRoomIds ?? []).filter((id): id is string => Boolean(id)),
  );

  for (const roomItem of roomBBoxes) {
    if (roomItem.id && skip.has(roomItem.id)) continue;
    if (intersectsBBox(lineBBox, roomItem.bbox)) {
      const intersects = turf.lineIntersect(line, roomItem.feature);
      const realIntersects = intersects.features.filter((f) => {
        const dStart = turf.distance(pt1, f, { units: 'meters' });
        const dEnd = turf.distance(pt2, f, { units: 'meters' });
        return dStart > 0.15 && dEnd > 0.15;
      });
      if (realIntersects.length > 0) return false;
      const mid = turf.midpoint(pt1, pt2);
      if (turf.booleanPointInPolygon(mid, roomItem.feature)) return false;
    }
  }

  for (const wallItem of wallBBoxes) {
    if (intersectsBBox(lineBBox, wallItem.bbox)) {
      const intersects = turf.lineIntersect(line, wallItem.feature);
      const realIntersects = intersects.features.filter((f) => {
        const dStart = turf.distance(pt1, f, { units: 'meters' });
        const dEnd = turf.distance(pt2, f, { units: 'meters' });
        return dStart > 0.35 && dEnd > 0.15;
      });
      if (realIntersects.length > 0) return false;
    }
  }

  return true;
}

async function loadFloorObstacles(prisma: PrismaClient, floorId: string) {
  const roomFeatures = await readAllGeoms(
    prisma,
    'physical_room',
    floorId,
    'outlineGeom',
  );
  const roomPolygons = roomFeatures
    .filter(
      (rf) =>
        rf.geometry &&
        (rf.geometry.type === 'Polygon' || rf.geometry.type === 'MultiPolygon'),
    )
    .map((rf) =>
      turf.feature(rf.geometry as Polygon | MultiPolygon, rf.properties),
    );

  const boundaryFeatures = await readAllGeoms(
    prisma,
    'boundary',
    floorId,
    'lineGeom',
  );
  const wallBoundaries = boundaryFeatures
    .filter((bf) => bf.properties.boundaryType === 'WALL' && bf.geometry)
    .map((bf) => turf.feature(bf.geometry));

  return { roomPolygons, wallBoundaries };
}

/**
 * Rebuild intra-floor edges from remaining nodes after manual corridor edits.
 * Does not regenerate MPRSS nodes. Connects corridor/junction k-nearest with
 * line-of-sight, then reuses door-to-corridor wiring in generateGraphEdges.
 */
export async function rebuildEdgesFromExistingNodes(
  prisma: PrismaClient,
  floorId: string,
  options?: { kNearest?: number; maxDistMeters?: number },
): Promise<{ totalEdges: number; nodesUsed: number }> {
  const kNearest = options?.kNearest ?? 3;
  const maxDistMeters = options?.maxDistMeters ?? 20;

  const { roomPolygons, wallBoundaries } = await loadFloorObstacles(
    prisma,
    floorId,
  );

  const nodeFeatures = await readAllGeoms(prisma, 'node', floorId, 'coordsGeom');
  const nodeMap = new Map<string, string>();
  const nodeCoordsMap = new Map<string, [number, number]>();
  const createdNodeTypesMap = new Map<string, NodeType>();
  const doorNodeCoordsMap = new Map<string, [number, number]>();
  const corridorNodes: { id: string; coords: [number, number] }[] = [];

  for (const feature of nodeFeatures) {
    if (!feature.geometry || feature.geometry.type !== 'Point') continue;
    const id = String(feature.properties.id);
    const coords = feature.geometry.coordinates as [number, number];
    const type = feature.properties.type as NodeType;
    const key = `${coords[0].toFixed(6)}_${coords[1].toFixed(6)}`;
    nodeMap.set(key, id);
    nodeCoordsMap.set(id, coords);
    createdNodeTypesMap.set(id, type);
    if (type === NodeType.CORRIDOR || type === NodeType.JUNCTION) {
      corridorNodes.push({ id, coords });
    }
    if (type === NodeType.ROOM_ENTRANCE) {
      doorNodeCoordsMap.set(id, coords);
    }
  }

  const roomBBoxes: RoomBBox[] = roomPolygons.map((room) => ({
    feature: room,
    bbox: getBBox(turf.coordAll(room) as [number, number][]),
    id: room.properties?.id,
  }));
  const wallBBoxes: WallBBox[] = wallBoundaries.map((wall) => ({
    feature: wall,
    bbox: getBBox(turf.coordAll(wall) as [number, number][]),
  }));

  const centerlineEdges: [[number, number], [number, number]][] = [];
  const seenPairs = new Set<string>();

  for (const a of corridorNodes) {
    const ranked = corridorNodes
      .filter((b) => b.id !== a.id)
      .map((b) => ({
        b,
        dist: turf.distance(turf.point(a.coords), turf.point(b.coords), {
          units: 'meters',
        }),
      }))
      .filter((item) => item.dist > 0 && item.dist <= maxDistMeters)
      .sort((x, y) => x.dist - y.dist);

    let added = 0;
    for (const { b } of ranked) {
      if (added >= kNearest) break;
      if (
        !hasCleanLineOfSight(a.coords, b.coords, roomBBoxes, wallBBoxes, {
          maxDistMeters,
        })
      ) {
        continue;
      }
      const pairKey = [a.id, b.id].sort().join('||');
      added += 1;
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);
      centerlineEdges.push([a.coords, b.coords]);
    }
  }

  await prisma.edge.deleteMany({
    where: {
      fromNode: { floorId },
      toNode: { floorId },
    },
  });

  const result = await generateGraphEdges(prisma, floorId, doorNodeCoordsMap, {
    walkable: null,
    roomPolygons,
    wallBoundaries,
    centerlineEdges,
    nodeMap,
    nodeCoordsMap,
    createdNodeTypesMap,
  });

  return { totalEdges: result.totalEdges, nodesUsed: nodeCoordsMap.size };
}
