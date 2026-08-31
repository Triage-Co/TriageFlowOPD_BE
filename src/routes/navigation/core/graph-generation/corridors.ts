import { PrismaClient, NodeType } from '@prisma/client';
import * as turf from '@turf/turf';
import type { Polygon, MultiPolygon } from 'geojson';
import { readAllGeoms, createNodesBatch, NodeInsertData } from './utils';
import { randomUUID } from 'crypto';

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

export async function generateCorridorNodes(
  prisma: PrismaClient,
  floorId: string,
  floorOutlineGeoJSON: any,
  options: { persist?: boolean } = {},
) {
  const persist = options.persist !== false;
  console.log(
    `🛣️  Calculating walkable space and generating MPRSS corridor nodes...`,
  );

  // 1. Load all rooms outlines & non-door areas outlines (e.g. Garden)
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

  // Load non-door area outlines (e.g., Garden or closed areas without doors)
  const boundaryFeaturesAll = await readAllGeoms(
    prisma,
    'boundary',
    floorId,
    'lineGeom',
  );
  const doorBoundariesAreaIds = new Set(
    boundaryFeaturesAll
      .filter(
        (bf) => bf.properties.boundaryType === 'DOOR' && bf.properties.areaId,
      )
      .map((bf) => bf.properties.areaId),
  );

  const areaFeatures = await readAllGeoms(
    prisma,
    'area',
    floorId,
    'outlineGeom',
  );
  const nonDoorAreaPolygons = areaFeatures
    .filter(
      (af) =>
        af.geometry &&
        (af.geometry.type === 'Polygon' || af.geometry.type === 'MultiPolygon'),
    )
    .filter((af) => !doorBoundariesAreaIds.has(af.properties.id))
    .map((af) =>
      turf.feature(af.geometry as Polygon | MultiPolygon, af.properties),
    );

  const obstaclePolygons = [...roomPolygons, ...nonDoorAreaPolygons];

  let obstacleUnion: any = null;
  let walkable: any = floorOutlineGeoJSON;

  if (obstaclePolygons.length > 0) {
    obstacleUnion = obstaclePolygons[0];
    if (obstaclePolygons.length > 1) {
      obstacleUnion = turf.union(turf.featureCollection(obstaclePolygons));
    }

    const floorFeature = turf.feature(floorOutlineGeoJSON);
    const diff = turf.difference(
      turf.featureCollection([floorFeature as any, obstacleUnion]),
    );
    if (diff) {
      walkable = diff.geometry;
    }
  }

  // 2. Fetch wall boundaries for edge collision filtering
  const boundaryFeatures = await readAllGeoms(
    prisma,
    'boundary',
    floorId,
    'lineGeom',
  );
  const wallBoundaries = boundaryFeatures
    .filter((bf) => bf.properties.boundaryType === 'WALL' && bf.geometry)
    .map((bf) => turf.feature(bf.geometry));

  // ── Step 1: Extract Boundary Base Points {P_b} ─────────────────────────────
  const allLines: [number, number][][] = [];

  const addLineFeature = (feat: any) => {
    if (!feat || !feat.geometry) return;
    const type = feat.geometry.type;
    const coords = feat.geometry.coordinates;
    if (type === 'LineString') {
      allLines.push(coords as [number, number][]);
    } else if (type === 'MultiLineString') {
      coords.forEach((subLine: any) => {
        allLines.push(subLine as [number, number][]);
      });
    }
  };

  // LineSet 1: Exact geometric boundaries of walkable space (outer walls + room walls facing corridors)
  const walkableFeature = turf.feature(walkable);
  const boundary = turf.polygonToLine(walkableFeature);
  if (boundary.type === 'FeatureCollection') {
    turf.featureEach(boundary, (feat) => {
      addLineFeature(feat);
    });
  } else {
    addLineFeature(boundary);
  }

  // LineSet 2: Non-room database walls (Area walls & standalone dividers) intersecting walkable space
  const nonRoomWallBoundaries = boundaryFeatures
    .filter(
      (bf) =>
        bf.properties.boundaryType === 'WALL' &&
        !bf.properties.roomId &&
        bf.geometry,
    )
    .map((bf) => turf.feature(bf.geometry));

  for (const wallFeat of nonRoomWallBoundaries) {
    if (turf.booleanIntersects(wallFeat, walkableFeature)) {
      addLineFeature(wallFeat);
    }
  }

  // Load Door nodes from database for the floor
  const doorFeatures = await readAllGeoms(
    prisma,
    'door',
    floorId,
    'positionGeom',
  );
  const doorCoords = doorFeatures
    .filter((df) => df.geometry && df.geometry.type === 'Point')
    .map((df) => df.geometry.coordinates as [number, number]);

  // A. Collect all corner vertices and door coordinates as critical points
  const criticalPoints: [number, number][] = [];
  const allCriticalCandidates = [...doorCoords];
  for (const line of allLines) {
    for (const pt of line) {
      allCriticalCandidates.push(pt);
    }
  }

  // De-duplicate critical points with a 10cm tolerance to merge overlapping corners
  for (const p of allCriticalCandidates) {
    const exists = criticalPoints.some((existing) => {
      const d = turf.distance(turf.point(p), turf.point(existing), {
        units: 'meters',
      });
      return d < 0.1;
    });
    if (!exists) {
      criticalPoints.push(p);
    }
  }

  // B. Generate candidate densified points from all lines
  const acceptedDensified: [number, number][] = [];

  for (const lineCoords of allLines) {
    if (lineCoords.length < 2) continue;

    const line = turf.lineString(lineCoords);
    const len = turf.length(line, { units: 'meters' });
    if (len < 0.01) continue;

    const chunks = turf.lineChunk(line, 2.0, { units: 'meters' });
    turf.featureEach(chunks, (chunk) => {
      const chunkCoords = turf.getCoords(chunk);
      [chunkCoords[0], chunkCoords[1]].forEach((pt: any) => {
        const p = pt as [number, number];

        // Check distance to all critical points (1.5m clearance to corners & doors)
        let tooClose = false;
        for (const crit of criticalPoints) {
          const d = turf.distance(turf.point(p), turf.point(crit), {
            units: 'meters',
          });
          if (d > 1e-4 && d < 1.5) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) return;

        // Check distance to already accepted densified points (1.5m clearance to prevent overlapping walls duplicate nodes)
        for (const existing of acceptedDensified) {
          const d = turf.distance(turf.point(p), turf.point(existing), {
            units: 'meters',
          });
          if (d < 1.5) {
            tooClose = true;
            break;
          }
        }

        if (!tooClose) {
          acceptedDensified.push(p);
        }
      });
    });
  }

  // Combine critical points and accepted densified points
  const points = [...criticalPoints, ...acceptedDensified];

  // Remove duplicates using precision coordinate keys
  const uniquePointsMap = new Map<string, any>();
  for (const p of points) {
    const key = `${p[0].toFixed(6)}_${p[1].toFixed(6)}`;
    uniquePointsMap.set(key, turf.point(p));
  }
  const uniquePoints = Array.from(uniquePointsMap.values());
  console.log(`📍 Boundary base points {P_b}: ${uniquePoints.length}`);

  // ── Step 2: Constrained Delaunay Triangulation (TIN) ────────────────────────
  const tinMesh = turf.tin(turf.featureCollection(uniquePoints));
  console.log(
    `📐 Delaunay Triangulation generated ${tinMesh.features.length} triangles`,
  );

  // Precompute room BBoxes
  const roomBBoxes = roomPolygons.map((room) => {
    const coords = turf.coordAll(room) as [number, number][];
    return {
      feature: room,
      bbox: getBBox(coords),
    };
  });

  // Precompute wall BBoxes
  const wallBBoxes = wallBoundaries.map((wall) => {
    const coords = turf.coordAll(wall) as [number, number][];
    return {
      feature: wall,
      bbox: getBBox(coords),
    };
  });

  // ── Step 3: Filter Crosswise Internal Edges {E_zigzag} ─────────────────────
  const candidateEdges: [[number, number], [number, number]][] = [];
  const tinEdges: [[number, number], [number, number]][] = [];
  const seenCandidateKeys = new Set<string>();
  const seenTinEdgeKeys = new Set<string>();

  const getEdgeKey = (p1: [number, number], p2: [number, number]) => {
    const k1 = `${p1[0].toFixed(6)}_${p1[1].toFixed(6)}`;
    const k2 = `${p2[0].toFixed(6)}_${p2[1].toFixed(6)}`;
    return [k1, k2].sort().join('||');
  };

  for (const triangle of tinMesh.features) {
    if (!triangle.geometry || triangle.geometry.type !== 'Polygon') continue;
    const coords = triangle.geometry.coordinates[0];
    const triangleEdges: [[number, number], [number, number]][] = [
      [coords[0] as [number, number], coords[1] as [number, number]],
      [coords[1] as [number, number], coords[2] as [number, number]],
      [coords[2] as [number, number], coords[0] as [number, number]],
    ];

    for (const [p1, p2] of triangleEdges) {
      const tinKey = getEdgeKey(p1, p2);
      if (!seenTinEdgeKeys.has(tinKey)) {
        seenTinEdgeKeys.add(tinKey);
        tinEdges.push([p1, p2]);
      }

      if (seenCandidateKeys.has(tinKey)) continue;
      seenCandidateKeys.add(tinKey);

      const pt1 = turf.point(p1);
      const pt2 = turf.point(p2);
      const midPoint = turf.midpoint(pt1, pt2);

      // 1. Edge midpoint must be strictly inside walkable space and outside rooms
      let insideWalkable = turf.booleanPointInPolygon(midPoint, walkable);
      if (insideWalkable) {
        for (const roomItem of roomBBoxes) {
          const ptCoords = midPoint.geometry.coordinates;
          const px = ptCoords[0];
          const py = ptCoords[1];
          if (
            px >= roomItem.bbox.minX &&
            px <= roomItem.bbox.maxX &&
            py >= roomItem.bbox.minY &&
            py <= roomItem.bbox.maxY
          ) {
            if (turf.booleanPointInPolygon(midPoint, roomItem.feature)) {
              insideWalkable = false;
              break;
            }
          }
        }
      }
      if (!insideWalkable) continue;

      // 2. Edge line must not intersect any room polygon or wall boundary
      const edgeLine = turf.lineString([p1, p2]);
      const edgeCoords = [p1, p2];
      const edgeBBox = getBBox(edgeCoords);

      let intersectsWall = false;
      for (const roomItem of roomBBoxes) {
        if (intersectsBBox(edgeBBox, roomItem.bbox)) {
          const intersects = turf.lineIntersect(edgeLine, roomItem.feature);
          const realIntersects = intersects.features.filter((f) => {
            const dStart = turf.distance(pt1, f, { units: 'meters' });
            const dEnd = turf.distance(pt2, f, { units: 'meters' });
            return dStart > 0.1 && dEnd > 0.1;
          });
          if (realIntersects.length > 0) {
            intersectsWall = true;
            break;
          }
        }
      }
      if (intersectsWall) continue;

      for (const wallItem of wallBBoxes) {
        if (intersectsBBox(edgeBBox, wallItem.bbox)) {
          const intersects = turf.lineIntersect(edgeLine, wallItem.feature);
          const realIntersects = intersects.features.filter((f) => {
            const dStart = turf.distance(pt1, f, { units: 'meters' });
            const dEnd = turf.distance(pt2, f, { units: 'meters' });
            return dStart > 0.1 && dEnd > 0.1;
          });
          if (realIntersects.length > 0) {
            intersectsWall = true;
            break;
          }
        }
      }
      if (intersectsWall) continue;

      // 3. Edge must not lie along boundary wall (distance of midpoint to nearest wall > 0.1m)
      let tooCloseToWall = false;
      const midCoordsPt = midPoint.geometry.coordinates;
      const mx = midCoordsPt[0];
      const my = midCoordsPt[1];

      for (const wallItem of wallBBoxes) {
        if (
          mx >= wallItem.bbox.minX - 0.000002 &&
          mx <= wallItem.bbox.maxX + 0.000002 &&
          my >= wallItem.bbox.minY - 0.000002 &&
          my <= wallItem.bbox.maxY + 0.000002
        ) {
          const dist = turf.pointToLineDistance(midPoint, wallItem.feature, {
            units: 'meters',
          });
          if (dist <= 0.1) {
            tooCloseToWall = true;
            break;
          }
        }
      }
      if (tooCloseToWall) continue;

      candidateEdges.push([p1, p2]);
    }
  }
  console.log(
    `⚡ Extracted ${candidateEdges.length} internal crosswise edges {E_zigzag}`,
  );

  // ── Step 4: Midpoint Node Creation {P_Mid} with Step Sampling ─────────────
  const rawMidpoints: [number, number][] = [];
  const rawMidpointKeys = new Set<string>();

  for (const [p1, p2] of candidateEdges) {
    const pt1 = turf.point(p1);
    const pt2 = turf.point(p2);
    const mid = turf.midpoint(pt1, pt2);
    const midCoords = mid.geometry.coordinates as [number, number];
    const mx = midCoords[0];
    const my = midCoords[1];

    // Filter out midpoints too close to any wall (< 0.55m)
    let tooCloseToWall = false;
    for (const wallItem of wallBBoxes) {
      if (
        mx >= wallItem.bbox.minX - 0.000006 &&
        mx <= wallItem.bbox.maxX + 0.000006 &&
        my >= wallItem.bbox.minY - 0.000006 &&
        my <= wallItem.bbox.maxY + 0.000006
      ) {
        const dist = turf.pointToLineDistance(mid, wallItem.feature, {
          units: 'meters',
        });
        if (dist < 0.55) {
          tooCloseToWall = true;
          break;
        }
      }
    }
    if (tooCloseToWall) continue;

    const key = `${midCoords[0].toFixed(6)}_${midCoords[1].toFixed(6)}`;
    if (!rawMidpointKeys.has(key)) {
      rawMidpointKeys.add(key);
      rawMidpoints.push(midCoords);
    }
  }

  const finalNodeCoords: [number, number][] = [...rawMidpoints];

  // ── Step 5: Voronoi Tessellation & Bounding Box Clipping ───────────────────
  const voronoiCellsMap = new Map<string, any>(); // nodeId -> GeoJSON Polygon geometry
  const nodeCellMap = new Map<number, any>(); // index -> clipped Polygon feature

  if (finalNodeCoords.length >= 2) {
    const pointsFC = turf.featureCollection(
      finalNodeCoords.map((c, idx) => turf.point(c, { idx })),
    ) as any;
    const walkableBBox = getBBox(
      turf.coordAll(walkableFeature) as [number, number][],
    );
    const paddedBBox: [number, number, number, number] = [
      walkableBBox.minX - 0.001,
      walkableBBox.minY - 0.001,
      walkableBBox.maxX + 0.001,
      walkableBBox.maxY + 0.001,
    ];

    const voronoiResult = turf.voronoi(pointsFC, { bbox: paddedBBox });

    for (let i = 0; i < finalNodeCoords.length; i++) {
      const ptCoords = finalNodeCoords[i];
      const pt = turf.point(ptCoords);

      let matchedCellFeature: any = null;
      if (voronoiResult && voronoiResult.features) {
        for (const feature of voronoiResult.features) {
          if (
            feature &&
            feature.geometry &&
            turf.booleanPointInPolygon(pt, feature as any)
          ) {
            matchedCellFeature = feature;
            break;
          }
        }
      }

      let finalCellGeom: any = null;
      if (matchedCellFeature) {
        try {
          const intersected = turf.intersect(
            turf.featureCollection([
              matchedCellFeature,
              walkableFeature as any,
            ]),
          );
          if (intersected && intersected.geometry) {
            finalCellGeom = intersected.geometry;
          } else {
            finalCellGeom = matchedCellFeature.geometry;
          }
        } catch {
          finalCellGeom = matchedCellFeature.geometry;
        }
      }

      if (!finalCellGeom) {
        const buffered = turf.buffer(pt, 1.0, { units: 'meters' });
        finalCellGeom = buffered ? buffered.geometry : undefined;
      }

      const cellFeat = turf.feature(finalCellGeom, { nodeIdx: i });
      nodeCellMap.set(i, cellFeat);
    }
  }

  // Helper: Comprehensive Line-of-sight collision check against room polygons AND wall boundaries
  const hasCleanLineOfSight = (
    p1: [number, number],
    p2: [number, number],
  ): boolean => {
    const dist = turf.distance(turf.point(p1), turf.point(p2), {
      units: 'meters',
    });
    if (dist > 25.0) return false;

    const line = turf.lineString([p1, p2]);
    const lineBBox = getBBox([p1, p2]);
    const pt1 = turf.point(p1);
    const pt2 = turf.point(p2);

    // 1. Check room polygon intersections & midpoint inside room
    for (const roomItem of roomBBoxes) {
      if (intersectsBBox(lineBBox, roomItem.bbox)) {
        const intersects = turf.lineIntersect(line, roomItem.feature);
        const realIntersects = intersects.features.filter((f) => {
          const dStart = turf.distance(pt1, f, { units: 'meters' });
          const dEnd = turf.distance(pt2, f, { units: 'meters' });
          return dStart > 0.1 && dEnd > 0.1;
        });

        if (realIntersects.length > 0) return false;

        const mid = turf.midpoint(pt1, pt2);
        if (turf.booleanPointInPolygon(mid, roomItem.feature)) return false;
      }
    }

    // 2. Check wall boundary line intersections (area walls, divider walls, outer walls)
    for (const wallItem of wallBBoxes) {
      if (intersectsBBox(lineBBox, wallItem.bbox)) {
        const intersects = turf.lineIntersect(line, wallItem.feature);
        const realIntersects = intersects.features.filter((f) => {
          const dStart = turf.distance(pt1, f, { units: 'meters' });
          const dEnd = turf.distance(pt2, f, { units: 'meters' });
          return dStart > 0.1 && dEnd > 0.1;
        });

        if (realIntersects.length > 0) return false;
      }
    }

    return true;
  };

  // ── Step 6: Node Relation Structure (Voronoi Adjacency Topology) ───────────
  const midpointAdjacency = new Map<number, Set<number>>();
  for (let i = 0; i < finalNodeCoords.length; i++) {
    midpointAdjacency.set(i, new Set());
  }

  for (let i = 0; i < finalNodeCoords.length; i++) {
    const cellA = nodeCellMap.get(i);

    for (let j = i + 1; j < finalNodeCoords.length; j++) {
      const cellB = nodeCellMap.get(j);

      const pA = finalNodeCoords[i];
      const pB = finalNodeCoords[j];
      const dist = turf.distance(turf.point(pA), turf.point(pB), {
        units: 'meters',
      });

      if (dist > 8.0) continue;

      let isCandidate = false;
      try {
        if (
          (cellA &&
            cellB &&
            (turf.booleanTouches(cellA, cellB) ||
              turf.booleanIntersects(cellA, cellB))) ||
          dist <= 5.5
        ) {
          isCandidate = true;
        }
      } catch {
        if (dist <= 5.5) isCandidate = true;
      }

      if (isCandidate) {
        if (hasCleanLineOfSight(pA, pB)) {
          midpointAdjacency.get(i)!.add(j);
          midpointAdjacency.get(j)!.add(i);
        }
      }
    }
  }

  // ── Step 7: Dual-Pruning Condition (Geometric Angle + Wall Clearance) ──────
  // 1. Geometric Angle Filter (< 45 deg)
  const computeAngleDegrees = (
    pB: [number, number],
    pA: [number, number],
    pC: [number, number],
  ): number => {
    const vBA = [pA[0] - pB[0], pA[1] - pB[1]];
    const vBC = [pC[0] - pB[0], pC[1] - pB[1]];
    const dot = vBA[0] * vBC[0] + vBA[1] * vBC[1];
    const magBA = Math.hypot(vBA[0], vBA[1]);
    const magBC = Math.hypot(vBC[0], vBC[1]);
    if (magBA === 0 || magBC === 0) return 180;
    const cos = Math.min(Math.max(dot / (magBA * magBC), -1), 1);
    return (Math.acos(cos) * 180) / Math.PI;
  };

  // 2. Wall Clearance / Convex Corner Filter (< 0.55m)
  const isTooCloseToWallCorner = (
    p1: [number, number],
    p2: [number, number],
  ): boolean => {
    const line = turf.lineString([p1, p2]);
    const pt1 = turf.point(p1);
    const pt2 = turf.point(p2);

    for (const corner of criticalPoints) {
      const cPt = turf.point(corner);
      const dStart = turf.distance(pt1, cPt, { units: 'meters' });
      const dEnd = turf.distance(pt2, cPt, { units: 'meters' });

      if (dStart > 0.35 && dEnd > 0.35) {
        const distToLine = turf.pointToLineDistance(cPt, line, {
          units: 'meters',
        });
        if (distToLine < 0.55) {
          return true;
        }
      }
    }
    return false;
  };

  for (let b = 0; b < finalNodeCoords.length; b++) {
    const neighbors = Array.from(midpointAdjacency.get(b) || []);
    if (neighbors.length < 2) continue;

    for (let i = 0; i < neighbors.length; i++) {
      for (let j = i + 1; j < neighbors.length; j++) {
        const a = neighbors[i];
        const c = neighbors[j];

        if (midpointAdjacency.get(a)?.has(c)) {
          const angle = computeAngleDegrees(
            finalNodeCoords[b],
            finalNodeCoords[a],
            finalNodeCoords[c],
          );
          if (angle < 45) {
            midpointAdjacency.get(a)!.delete(c);
            midpointAdjacency.get(c)!.delete(a);
          }
        }
      }
    }
  }

  for (let i = 0; i < finalNodeCoords.length; i++) {
    const neighbors = Array.from(midpointAdjacency.get(i) || []);
    for (const j of neighbors) {
      if (i < j) {
        if (isTooCloseToWallCorner(finalNodeCoords[i], finalNodeCoords[j])) {
          midpointAdjacency.get(i)!.delete(j);
          midpointAdjacency.get(j)!.delete(i);
        }
      }
    }
  }

  // ── Step 8: Classify JUNCTION vs CORRIDOR and Persist Nodes ───────────────
  const nodeMap = new Map<string, string>(); // key -> nodeId
  const nodeCoordsMap = new Map<string, [number, number]>(); // nodeId -> coords
  const createdNodeTypesMap = new Map<string, NodeType>(); // nodeId -> type
  const getCoordKey = (p: [number, number]) =>
    `${p[0].toFixed(6)}_${p[1].toFixed(6)}`;

  const nodesToCreate: NodeInsertData[] = [];

  for (let i = 0; i < finalNodeCoords.length; i++) {
    const coords = finalNodeCoords[i];
    const key = getCoordKey(coords);
    const degree = midpointAdjacency.get(i)?.size || 0;
    const type = degree >= 3 ? NodeType.JUNCTION : NodeType.CORRIDOR;

    const cellFeat = nodeCellMap.get(i);
    const cellGeom = cellFeat ? cellFeat.geometry : null;

    const nodeId = randomUUID();
    nodesToCreate.push({
      id: nodeId,
      floorId,
      type,
      coords,
      metadata: cellGeom ? { voronoiCell: cellGeom } : undefined,
    });
    nodeMap.set(key, nodeId);
    nodeCoordsMap.set(nodeId, coords);
    createdNodeTypesMap.set(nodeId, type);
    if (cellGeom) {
      voronoiCellsMap.set(nodeId, cellGeom);
    }
  }

  if (persist) {
    await createNodesBatch(prisma, nodesToCreate);
    console.log(
      `🛣️  Created ${nodeMap.size} MPRSSEM corridor/junction nodes {P_Mid}`,
    );
  } else {
    console.log(
      `🛣️  Computed ${nodeMap.size} MPRSSEM corridor/junction nodes {P_Mid} (not persisted)`,
    );
  }

  // Build centerline edge list for edges.ts
  const centerlineEdgesTyped: [[number, number], [number, number]][] = [];
  for (let i = 0; i < finalNodeCoords.length; i++) {
    const neighbors = midpointAdjacency.get(i);
    if (!neighbors) continue;
    for (const j of neighbors) {
      if (i < j) {
        centerlineEdgesTyped.push([finalNodeCoords[i], finalNodeCoords[j]]);
      }
    }
  }

  return {
    walkable,
    roomPolygons,
    wallBoundaries,
    centerlineEdges: centerlineEdgesTyped,
    nodeMap,
    nodeCoordsMap,
    createdNodeTypesMap,
    voronoiCellsMap,
    uniquePoints, // Step 1: P_b Base points
    tinEdges, // Step 2: Delaunay TIN triangle edges
    candidateEdges, // Step 3: E_zigzag internal crosswise edges
    finalNodeCoords, // Step 4: P_Mid midpoint corridor nodes
  };
}
