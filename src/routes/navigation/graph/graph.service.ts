import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../../../shared/config/prisma.service';
import { GeoService } from '../../../shared/geo/geo.service';
import * as turf from '@turf/turf';
import { NodeType, ConnectorType } from '@prisma/client';
import { Polygon, MultiPolygon } from 'geojson';

@Injectable()
export class GraphGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geoService: GeoService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) { }

  private async createNode(
    floorId: string,
    type: NodeType,
    coords: [number, number],
    metadata?: object,
  ) {
    const node = await this.prisma.node.create({
      data: {
        floorId,
        type,
        metadata,
      },
    });
    await this.geoService.updateGeom(
      'node',
      node.id,
      'coordsGeom',
      this.geoService.toWKT(coords[0], coords[1]),
    );
    return node;
  }

  async createCorridorNode(floorId: string, coords: [number, number]) {
    const floor = await this.prisma.floor.findUnique({
      where: { id: floorId },
    });
    if (!floor) {
      throw new NotFoundException(`Floor with ID ${floorId} not found`);
    }

    const node = await this.createNode(floorId, NodeType.CORRIDOR, coords);

    const existingNodes = await this.prisma.node.findMany({
      where: {
        floorId,
        type: { in: [NodeType.CORRIDOR, NodeType.JUNCTION] },
        active: true,
      },
    });

    let nearestNodeId: string | null = null;
    let minDistance = Infinity;
    for (const existing of existingNodes) {
      if (existing.id === node.id) continue;
      const existingGeom = (await this.geoService.readGeom(
        'node',
        existing.id,
        'coordsGeom',
      )) as any;
      if (!existingGeom || existingGeom.type !== 'Point') continue;
      const dist = turf.distance(
        turf.point(coords),
        turf.point(existingGeom.coordinates as [number, number]),
        { units: 'meters' },
      );
      if (dist < minDistance) {
        minDistance = dist;
        nearestNodeId = existing.id;
      }
    }

    if (nearestNodeId && minDistance < 5.0) {
      await this.prisma.edge.createMany({
        data: [
          {
            fromNodeId: node.id,
            toNodeId: nearestNodeId,
            distance: minDistance,
          },
          {
            fromNodeId: nearestNodeId,
            toNodeId: node.id,
            distance: minDistance,
          },
        ],
        skipDuplicates: true,
      });
    }

    return { nodeId: node.id, connectedTo: nearestNodeId, distance: minDistance };
  }

  /**
   * Deterministically generate the navigation graph for a given floor.
   */
  /**
   * Deterministically generate the navigation graph for a given floor using MPRSSEM (v3).
   * Middle-Point Relation Structure Segment Entrance Modification.
   */
  async generateGraph(floorId: string) {
    const startTime = Date.now();

    const floor = await this.prisma.floor.findUnique({
      where: { id: floorId },
    });
    if (!floor) {
      throw new NotFoundException(`Floor with ID ${floorId} not found`);
    }

    const floorOutlineGeoJSON = (await this.geoService.readGeom(
      'floor',
      floorId,
      'outlineGeom',
    )) as any;

    if (!floorOutlineGeoJSON) {
      throw new BadRequestException('Floor has no outline geometry defined');
    }

    // Clear existing nodes for this floor
    await this.prisma.node.deleteMany({
      where: { floorId },
    });

    // ─── STEP 1: Door Node Resolution ─────────────────────────────────────────
    // Extract door positions and create ROOM_ENTRANCE nodes at door positions.
    // (Room centroid nodes are intentionally omitted as per v3 spec).
    const doorFeatures = await this.geoService.readAllGeoms(
      'door',
      floorId,
      'positionGeom',
    );
    const activeDoorFeatures = doorFeatures.filter(
      (df) => df.properties.active !== false,
    );

    const doorNodeCoordsMap = new Map<string, [number, number]>();
    for (const doorFeature of activeDoorFeatures) {
      const geo = doorFeature.geometry;
      let coords: [number, number] | null = null;

      if (geo && geo.type === 'Point') {
        coords = geo.coordinates as [number, number];
      }

      if (!coords) {
        const fallback = turf.centroid(floorOutlineGeoJSON);
        coords = fallback.geometry.coordinates as [number, number];
      }

      const doorId = doorFeature.properties.id;
      const node = await this.createNode(
        floorId,
        NodeType.ROOM_ENTRANCE,
        coords,
        { doorId },
      );

      await this.prisma.door.update({
        where: { id: doorId },
        data: { nodeId: node.id },
      });

      doorNodeCoordsMap.set(node.id, coords);
    }

    // ─── STEP 2: Geometry & Walkable Zone Extraction ──────────────────────────
    const roomFeatures = await this.geoService.readAllGeoms(
      'physical_room',
      floorId,
      'outlineGeom',
    );

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

      const diff = turf.difference(
        turf.featureCollection([turf.feature(floorOutlineGeoJSON) as any, roomUnion as any]),
      );
      if (diff) {
        walkable = diff.geometry;
      }
    }

    // Fetch wall boundaries for edge pruning and collision checking
    const boundaryFeatures = await this.geoService.readAllGeoms(
      'boundary',
      floorId,
      'lineGeom',
    );
    const wallBoundaries = boundaryFeatures
      .filter((bf) => bf.properties.boundaryType === 'WALL' && bf.geometry)
      .map((bf) => turf.feature(bf.geometry));

    // ─── STEP 3: Delaunay Triangulation & Internal Edge Extraction (MPRSS) ────
    const exploded = turf.explode(walkable);
    const uniquePointsMap = new Map<string, any>();
    for (const feature of exploded.features) {
      const c = feature.geometry.coordinates;
      const key = `${c[0].toFixed(6)}_${c[1].toFixed(6)}`;
      uniquePointsMap.set(key, feature);
    }
    const uniquePoints = Array.from(uniquePointsMap.values());

    // Delaunay Triangulation using turf.tin
    const tinMesh = turf.tin(turf.featureCollection(uniquePoints));

    const candidateEdges: [[number, number], [number, number]][] = [];
    const seenCandidateKeys = new Set<string>();

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
        const key = getEdgeKey(p1, p2);
        if (seenCandidateKeys.has(key)) continue;
        seenCandidateKeys.add(key);

        const pt1 = turf.point(p1);
        const pt2 = turf.point(p2);
        const midPoint = turf.midpoint(pt1, pt2);
        const midCoord = midPoint.geometry.coordinates as [number, number];

        // 1. Edge midpoint must be strictly inside walkable space and outside rooms
        let insideWalkable = turf.booleanPointInPolygon(midPoint, walkable);
        if (insideWalkable) {
          for (const roomPoly of roomPolygons) {
            if (turf.booleanPointInPolygon(midPoint, roomPoly)) {
              insideWalkable = false;
              break;
            }
          }
        }
        if (!insideWalkable) continue;

        // 2. Edge line must not intersect any room polygon or wall boundary
        const edgeLine = turf.lineString([p1, p2]);
        let intersectsWall = false;
        for (const roomPoly of roomPolygons) {
          if (turf.lineIntersect(edgeLine, roomPoly).features.length > 0) {
            intersectsWall = true;
            break;
          }
        }
        if (intersectsWall) continue;

        for (const wall of wallBoundaries) {
          if (turf.lineIntersect(edgeLine, wall).features.length > 0) {
            intersectsWall = true;
            break;
          }
        }
        if (intersectsWall) continue;

        // 3. Edge must not lie on boundary wall (distance of midpoint to nearest wall > 0.1m)
        let tooCloseToWall = false;
        for (const wall of wallBoundaries) {
          const dist = turf.pointToLineDistance(midPoint, wall, { units: 'meters' });
          if (dist <= 0.1) {
            tooCloseToWall = true;
            break;
          }
        }
        if (tooCloseToWall) continue;

        candidateEdges.push([p1, p2]);
      }
    }

    // ─── STEP 4: Midpoint Node Creation (Corridor Nodes) ──────────────────────
    const midpointNodes: {
      id: string;
      coords: [number, number];
      feature: any;
    }[] = [];
    const midpointCoordsMap = new Map<string, [number, number]>();

    for (const [p1, p2] of candidateEdges) {
      const pt1 = turf.point(p1);
      const pt2 = turf.point(p2);
      const mid = turf.midpoint(pt1, pt2);
      const midCoords = mid.geometry.coordinates as [number, number];

      const node = await this.createNode(floorId, NodeType.CORRIDOR, midCoords);
      midpointNodes.push({
        id: node.id,
        coords: midCoords,
        feature: turf.point(midCoords, { nodeId: node.id }),
      });
      midpointCoordsMap.set(node.id, midCoords);
    }

    // ─── STEP 5 & 6: Voronoi Topological Interconnection (MPRSSE) ─────────────
    const candidateConnections = new Set<string>();

    if (midpointNodes.length >= 3) {
      const bbox = turf.bbox(walkable);
      const midpointFeatures = midpointNodes.map((mn) => mn.feature);
      const voronoiPolygons = turf.voronoi(
        turf.featureCollection(midpointFeatures),
        { bbox },
      );

      // Map cell features to node IDs
      const cellNodeMap: { cell: any; nodeId: string }[] = [];
      for (let i = 0; i < voronoiPolygons.features.length; i++) {
        const cell = voronoiPolygons.features[i];
        if (cell && cell.geometry && cell.geometry.type === 'Polygon') {
          cellNodeMap.push({
            cell,
            nodeId: midpointNodes[i].id,
          });
        }
      }

      // Segment-Segment (Corridor-Corridor): Adjacent Voronoi cells share edges
      for (let i = 0; i < cellNodeMap.length; i++) {
        for (let j = i + 1; j < cellNodeMap.length; j++) {
          const cellA = cellNodeMap[i].cell;
          const cellB = cellNodeMap[j].cell;
          const ringA = cellA.geometry.coordinates[0];
          const ringB = cellB.geometry.coordinates[0];

          // Check if cells A and B share at least 2 vertices (a common edge)
          let sharedCount = 0;
          for (const pA of ringA) {
            for (const pB of ringB) {
              const dx = Math.abs(pA[0] - pB[0]);
              const dy = Math.abs(pA[1] - pB[1]);
              if (dx < 1e-5 && dy < 1e-5) {
                sharedCount++;
                break;
              }
            }
            if (sharedCount >= 2) break;
          }

          if (sharedCount >= 2) {
            const edgeKey = [cellNodeMap[i].nodeId, cellNodeMap[j].nodeId]
              .sort()
              .join('||');
            candidateConnections.add(edgeKey);
          }
        }
      }

      // Door-Segment (Door-Corridor): Find Voronoi cell containing the door node
      for (const [doorNodeId, doorCoords] of doorNodeCoordsMap.entries()) {
        const doorPt = turf.point(doorCoords);
        let connected = false;

        for (const item of cellNodeMap) {
          if (turf.booleanPointInPolygon(doorPt, item.cell)) {
            const edgeKey = [doorNodeId, item.nodeId].sort().join('||');
            candidateConnections.add(edgeKey);
            connected = true;
            break;
          }
        }

        // Fallback: If door lies on boundary of all cells, connect to nearest midpoint node
        if (!connected && midpointNodes.length > 0) {
          let minD = Infinity;
          let nearestId: string | null = null;
          for (const mn of midpointNodes) {
            const dist = turf.distance(doorPt, turf.point(mn.coords), {
              units: 'meters',
            });
            if (dist < minD) {
              minD = dist;
              nearestId = mn.id;
            }
          }
          if (nearestId) {
            const edgeKey = [doorNodeId, nearestId].sort().join('||');
            candidateConnections.add(edgeKey);
          }
        }
      }
    } else {
      // Fallback for tiny floors with fewer than 3 midpoints
      for (const [doorNodeId, doorCoords] of doorNodeCoordsMap.entries()) {
        for (const mn of midpointNodes) {
          const edgeKey = [doorNodeId, mn.id].sort().join('||');
          candidateConnections.add(edgeKey);
        }
      }
    }

    // Combine all node coordinates map for distance calculation
    const allNodeCoordsMap = new Map<string, [number, number]>([
      ...doorNodeCoordsMap,
      ...midpointCoordsMap,
    ]);

    // ─── STEP 7: Edge Pruning Filter (MPRSSEM) ────────────────────────────────
    // Remove edges with distance to nearest wall segment < 0.55m or intersecting walls
    const edgesToCreate: {
      fromNodeId: string;
      toNodeId: string;
      distance: number;
    }[] = [];

    const SAFETY_DISTANCE = 0.55; // 0.55m safe clearance from walls

    for (const edgeKey of candidateConnections) {
      const [idA, idB] = edgeKey.split('||');
      const coordsA = allNodeCoordsMap.get(idA);
      const coordsB = allNodeCoordsMap.get(idB);
      if (!coordsA || !coordsB) continue;

      const edgeLine = turf.lineString([coordsA, coordsB]);
      let pruned = false;

      // 1. Check if edge intersects any room polygon or wall boundary (with tolerance near door nodes)
      const checkIntersectionWithTolerance = (geom: any): boolean => {
        const intersects = turf.lineIntersect(edgeLine, geom);
        if (intersects.features.length === 0) return false;

        for (const inter of intersects.features) {
          const interPt = inter.geometry.coordinates;
          const distToA = turf.distance(turf.point(interPt), turf.point(coordsA), { units: 'meters' });
          const distToB = turf.distance(turf.point(interPt), turf.point(coordsB), { units: 'meters' });

          const isNearDoorA = doorNodeCoordsMap.has(idA) && distToA < 0.15;
          const isNearDoorB = doorNodeCoordsMap.has(idB) && distToB < 0.15;

          if (!isNearDoorA && !isNearDoorB) {
            return true; // Valid blocking intersection
          }
        }
        return false;
      };

      for (const roomPoly of roomPolygons) {
        if (checkIntersectionWithTolerance(roomPoly)) {
          pruned = true;
          break;
        }
      }
      if (pruned) continue;

      for (const wall of wallBoundaries) {
        if (checkIntersectionWithTolerance(wall)) {
          pruned = true;
          break;
        }
      }
      if (pruned) continue;

      // 2. Check safety distance from edge to wall boundaries (< 0.55m)
      const edgeLength = turf.length(edgeLine, { units: 'meters' });
      const sampleSteps = Math.max(3, Math.ceil(edgeLength / 0.5));
      for (let s = 0; s <= sampleSteps; s++) {
        const distanceFromStart = (s / sampleSteps) * edgeLength;
        const distanceFromEnd = edgeLength - distanceFromStart;

        // Skip safety distance check near the endpoints if they are door nodes
        const isNearDoor =
          (doorNodeCoordsMap.has(idA) && distanceFromStart < SAFETY_DISTANCE) ||
          (doorNodeCoordsMap.has(idB) && distanceFromEnd < SAFETY_DISTANCE);

        if (isNearDoor) continue;

        const samplePt = turf.along(edgeLine, distanceFromStart, {
          units: 'meters',
        });

        for (const wall of wallBoundaries) {
          const dist = turf.pointToLineDistance(samplePt, wall, {
            units: 'meters',
          });
          if (dist < SAFETY_DISTANCE) {
            pruned = true;
            break;
          }
        }
        if (pruned) break;
      }
      if (pruned) continue;

      // Safe edge: compute weight (distance in meters)
      const distance = turf.distance(turf.point(coordsA), turf.point(coordsB), {
        units: 'meters',
      });
      edgesToCreate.push(
        { fromNodeId: idA, toNodeId: idB, distance },
        { fromNodeId: idB, toNodeId: idA, distance },
      );
    }

    // ─── STEP 8: Persist Graph & Invalidate Cache ─────────────────────────────
    if (edgesToCreate.length > 0) {
      await this.prisma.edge.createMany({
        data: edgesToCreate,
        skipDuplicates: true,
      });
    }

    const totalNodes = await this.prisma.node.count({ where: { floorId } });
    const totalEdges = await this.prisma.edge.count({
      where: { fromNode: { floorId } },
    });

    await this.cacheManager.del(`building_map:${floor.buildingId}`);

    return {
      nodesCreated: totalNodes,
      edgesCreated: totalEdges,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Get all nodes and edges associated with a floor.
   */
  async getGraph(floorId: string) {
    const nodeFeatures = await this.geoService.readAllGeoms(
      'node',
      floorId,
      'coordsGeom',
    );

    const nodes = nodeFeatures.map((f) => ({
      id: f.properties.id,
      type: f.properties.type,
      coords: f.geometry ? f.geometry.coordinates : null,
      metadata: f.properties.metadata,
    }));

    const edges = await this.prisma.edge.findMany({
      where: {
        fromNode: { floorId },
      },
    });

    return { nodes, edges };
  }

  /**
   * Manually link two connector nodes across floors (elevators, stairs).
   */
  async linkConnector(connectorId: string, coords?: number[]) {
    const connector = await this.prisma.connector.findUnique({
      where: { id: connectorId },
    });
    if (!connector) {
      throw new NotFoundException(`Connector ${connectorId} not found`);
    }

    const servedFloors = connector.servedFloors;
    if (servedFloors.length < 2) {
      throw new BadRequestException('Connector must serve at least 2 floors to link');
    }

    // Fetch the served floors records
    const floors = await this.prisma.floor.findMany({
      where: {
        buildingId: connector.buildingId,
        floorNumber: { in: servedFloors },
      },
    });

    // Find nodes of matching type (ELEVATOR, STAIRS, ESCALATOR) on each floor
    let targetType: NodeType;
    if (connector.type === ConnectorType.ELEVATOR) {
      targetType = NodeType.ELEVATOR;
    } else if (connector.type === ConnectorType.STAIRS) {
      targetType = NodeType.STAIRS;
    } else if (connector.type === ConnectorType.ESCALATOR) {
      targetType = NodeType.ESCALATOR;
    } else {
      // Fallback
      targetType = NodeType.ELEVATOR;
    }

    const floorNodes: { floorNumber: number; node: any; coords: [number, number] }[] = [];

    for (const floor of floors) {
      // Read all nodes of type on this floor
      const nodeFeatures = await this.geoService.readAllGeoms(
        'node',
        floor.id,
        'coordsGeom',
      );

      const matchingFeatures = nodeFeatures.filter(
        (f) => f.properties.type === targetType,
      );

      if (matchingFeatures.length === 0) {
        continue;
      }

      let selectedFeature = matchingFeatures[0];

      // If coords are provided, pick the closest matching node
      if (coords && coords.length === 2) {
        let minDistance = Infinity;
        for (const feat of matchingFeatures) {
          const pt = feat.geometry;
          if (pt && pt.type === 'Point') {
            const dist = turf.distance(
              turf.point(coords),
              turf.point(pt.coordinates),
              { units: 'meters' },
            );
            if (dist < minDistance) {
              minDistance = dist;
              selectedFeature = feat;
            }
          }
        }
      }

      if (selectedFeature && selectedFeature.geometry) {
        floorNodes.push({
          floorNumber: floor.floorNumber,
          node: selectedFeature.properties,
          coords: selectedFeature.geometry.coordinates as [number, number],
        });
      }
    }

    if (floorNodes.length < 2) {
      throw new BadRequestException(
        `Found only ${floorNodes.length} nodes of type ${targetType} across the served floors. Cannot create link edges. Please ensure connector nodes exist on each floor.`,
      );
    }

    // Sort by floorNumber to link sequentially (floor 1 -> floor 2 -> floor 3)
    floorNodes.sort((a, b) => a.floorNumber - b.floorNumber);

    let linksCreated = 0;
    for (let i = 0; i < floorNodes.length - 1; i++) {
      const nodeA = floorNodes[i];
      const nodeB = floorNodes[i + 1];

      // Standard distance between floors (4m height difference per floor)
      const heightDifference = Math.abs(nodeA.floorNumber - nodeB.floorNumber) * 4.0;

      // Penalties: Stairs = +30m, Elevator = +60m
      let penalty = 0;
      if (connector.type === ConnectorType.STAIRS) {
        penalty = 30;
      } else if (connector.type === ConnectorType.ELEVATOR) {
        penalty = 60;
      }

      const totalCost = heightDifference + penalty;

      // Check if edges already exist, delete them to make it idempotent
      await this.prisma.edge.deleteMany({
        where: {
          OR: [
            { fromNodeId: nodeA.node.id, toNodeId: nodeB.node.id },
            { fromNodeId: nodeB.node.id, toNodeId: nodeA.node.id },
          ],
        },
      });

      await this.prisma.edge.createMany({
        data: [
          {
            fromNodeId: nodeA.node.id,
            toNodeId: nodeB.node.id,
            distance: totalCost,
            isElevator: connector.type === ConnectorType.ELEVATOR,
            isStairs: connector.type === ConnectorType.STAIRS,
            isEscalator: connector.type === ConnectorType.ESCALATOR,
          },
          {
            fromNodeId: nodeB.node.id,
            toNodeId: nodeA.node.id,
            distance: totalCost,
            isElevator: connector.type === ConnectorType.ELEVATOR,
            isStairs: connector.type === ConnectorType.STAIRS,
            isEscalator: connector.type === ConnectorType.ESCALATOR,
          },
        ],
      });

      linksCreated += 2;
    }

    await this.cacheManager.del(`building_map:${connector.buildingId}`);

    return {
      message: 'Connector linked successfully',
      linksCreated,
    };
  }
}
