import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../../shared/config/prisma.service';
import { GeoService } from '../../shared/geo/geo.service';
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

  /**
   * Deterministically generate the navigation graph for a given floor.
   */
  async generateGraph(floorId: string) {
    const startTime = Date.now();

    // 1. Fetch floor details
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

    // 2. Clear existing graph components (nodes, cascading to edges & blockages)
    await this.prisma.node.deleteMany({
      where: { floorId },
    });

    // --- Step 1: Room Node Extraction ---
    const roomFeatures = await this.geoService.readAllGeoms(
      'physical_room',
      floorId,
      'outlineGeom',
    );

    const roomNodeMap = new Map<string, string>(); // roomId -> nodeId
    const roomCoordsMap = new Map<string, [number, number]>(); // roomId -> coordinates

    for (const roomFeature of roomFeatures) {
      const poly = roomFeature.geometry;
      if (!poly || (poly.type !== 'Polygon' && poly.type !== 'MultiPolygon')) {
        continue;
      }

      // Compute centroid
      const centroid = turf.centroid(poly);
      let coords = centroid.geometry.coordinates as [number, number];

      // Fallback for non-convex polygon
      if (poly.type === 'Polygon') {
        const isInside = turf.booleanPointInPolygon(centroid, poly);
        if (!isInside) {
          const pointOnFeature = turf.pointOnFeature(poly);
          coords = pointOnFeature.geometry.coordinates as [number, number];
        }
      }

      const roomId = roomFeature.properties.id;
      const node = await this.prisma.node.create({
        data: {
          floorId,
          type: NodeType.ROOM_ENTRANCE,
          metadata: { roomId },
        },
      });

      await this.geoService.updateGeom(
        'node',
        node.id,
        'coordsGeom',
        this.geoService.toWKT(coords[0], coords[1]),
      );

      roomNodeMap.set(roomId, node.id);
      roomCoordsMap.set(roomId, coords);
    }

    // --- Step 2: Door Node Extraction ---
    const doorFeatures = await this.geoService.readAllGeoms(
      'door',
      floorId,
      'positionGeom',
    );
    const activeDoorFeatures = doorFeatures.filter(
      (df) => df.properties.active !== false,
    );

    const doorNodeCoordsMap = new Map<string, [number, number]>(); // nodeId -> coords

    for (const doorFeature of activeDoorFeatures) {
      const poly = doorFeature.geometry;
      let coords: [number, number] | null = null;

      if (poly && poly.type === 'Point') {
        coords = poly.coordinates as [number, number];
      } else {
        // Fallback: Midpoint of adjacent rooms
        const roomAId = doorFeature.properties.roomAId;
        const roomBId = doorFeature.properties.roomBId;
        if (roomAId && roomBId) {
          const coordsA = roomCoordsMap.get(roomAId);
          const coordsB = roomCoordsMap.get(roomBId);
          if (coordsA && coordsB) {
            const mid = turf.midpoint(turf.point(coordsA), turf.point(coordsB));
            coords = mid.geometry.coordinates as [number, number];
          }
        }
        if (!coords && roomAId) {
          coords = roomCoordsMap.get(roomAId) || null;
        }
        if (!coords && roomBId) {
          coords = roomCoordsMap.get(roomBId) || null;
        }
      }

      if (!coords) {
        // Default to a fallback position inside the floor if unable to resolve
        coords = turf.centroid(floorOutlineGeoJSON).geometry.coordinates as [
          number,
          number,
        ];
      }

      const doorId = doorFeature.properties.id;
      const node = await this.prisma.node.create({
        data: {
          floorId,
          type: NodeType.ROOM_ENTRANCE,
          metadata: { doorId },
        },
      });

      await this.geoService.updateGeom(
        'node',
        node.id,
        'coordsGeom',
        this.geoService.toWKT(coords[0], coords[1]),
      );

      // Link door to node
      await this.prisma.door.update({
        where: { id: doorId },
        data: { nodeId: node.id },
      });

      doorNodeCoordsMap.set(node.id, coords);
    }

    // --- Step 3: Corridor Node Generation ---
    // 1. Walkable Area Extraction
    const roomPolygons = roomFeatures
      .map((rf) => rf.geometry)
      .filter((g) => g && (g.type === 'Polygon' || g.type === 'MultiPolygon'))
      .map((g) => turf.feature(g as Polygon | MultiPolygon));

    let roomUnion: any = null;
    if (roomPolygons.length > 0) {
      if (roomPolygons.length === 1) {
        roomUnion = roomPolygons[0];
      } else {
        roomUnion = turf.union(turf.featureCollection(roomPolygons));
      }
    }

    let walkable: any = floorOutlineGeoJSON;
    if (roomUnion) {
      const diff = turf.difference(
        turf.featureCollection([turf.feature(floorOutlineGeoJSON), roomUnion]),
      );
      if (diff) {
        walkable = diff.geometry;
      }
    }

    // 2. Voronoi Skeleton
    const exploded = turf.explode(walkable);
    const uniquePointsMap = new Map<string, any>();
    for (const f of exploded.features) {
      const c = f.geometry.coordinates;
      const key = `${c[0].toFixed(6)}_${c[1].toFixed(6)}`;
      uniquePointsMap.set(key, f);
    }
    const uniquePoints = Array.from(uniquePointsMap.values());

    const bbox = turf.bbox(floorOutlineGeoJSON);
    const voronoiPolygons = turf.voronoi(
      turf.featureCollection(uniquePoints),
      { bbox },
    );

    const voronoiEdges: [[number, number], [number, number]][] = [];
    const seenEdges = new Set<string>();

    for (const cell of voronoiPolygons.features) {
      if (!cell || cell.geometry.type !== 'Polygon') continue;
      const ring = cell.geometry.coordinates[0];
      for (let i = 0; i < ring.length - 1; i++) {
        const p1 = ring[i];
        const p2 = ring[i + 1];

        const k1 = `${p1[0].toFixed(6)}_${p1[1].toFixed(6)}`;
        const k2 = `${p2[0].toFixed(6)}_${p2[1].toFixed(6)}`;
        if (k1 === k2) continue;

        const edgeKey = [k1, k2].sort().join('||');
        if (seenEdges.has(edgeKey)) continue;
        seenEdges.add(edgeKey);

        voronoiEdges.push([p1 as [number, number], p2 as [number, number]]);
      }
    }

    // Filter edges to retain centerline
    const isPointInsidePolygon = (c: number[], polygon: any) => {
      return turf.booleanPointInPolygon(turf.point(c), polygon);
    };

    const isInsideWalkable = (c: number[]) => {
      if (!isPointInsidePolygon(c, floorOutlineGeoJSON)) return false;
      if (roomUnion && isPointInsidePolygon(c, roomUnion)) return false;
      return true;
    };

    const centerlineEdges: [[number, number], [number, number]][] = [];
    for (const [p1, p2] of voronoiEdges) {
      const pt1 = turf.point(p1);
      const pt2 = turf.point(p2);
      const mid = turf.midpoint(pt1, pt2);

      if (
        !isInsideWalkable(p1) ||
        !isInsideWalkable(p2) ||
        !isInsideWalkable(mid.geometry.coordinates)
      ) {
        continue;
      }

      // Filter out rib lines close to the walls (0.4m threshold)
      let tooClose = false;
      for (const boundaryPt of uniquePoints) {
        const dist1 = turf.distance(pt1, boundaryPt, { units: 'meters' });
        const dist2 = turf.distance(pt2, boundaryPt, { units: 'meters' });
        if (dist1 < 0.4 || dist2 < 0.4) {
          tooClose = true;
          break;
        }
      }

      if (!tooClose) {
        centerlineEdges.push([p1, p2]);
      }
    }

    // 3. Adjacency and Junction Detection
    const vertexAdjacency = new Map<string, Set<string>>();
    const keyToCoords = new Map<string, [number, number]>();
    const getVertexKey = (p: [number, number]) =>
      `${p[0].toFixed(6)}_${p[1].toFixed(6)}`;

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
      if (neighbors.size >= 3) {
        junctionKeys.add(key);
      }
    }

    // Helper to persist node and coordsGeom
    const createNodeHelper = async (type: NodeType, coords: [number, number]) => {
      const node = await this.prisma.node.create({
        data: {
          floorId,
          type,
        },
      });
      await this.geoService.updateGeom(
        'node',
        node.id,
        'coordsGeom',
        this.geoService.toWKT(coords[0], coords[1]),
      );
      return node.id;
    };

    const nodeMap = new Map<string, string>(); // coordsKey -> nodeId
    const nodeCoordsMap = new Map<string, [number, number]>(); // nodeId -> coords
    const createdNodeTypesMap = new Map<string, NodeType>(); // nodeId -> NodeType

    // Persist all skeleton junction and segment end nodes
    for (const [key, coords] of keyToCoords.entries()) {
      const type = junctionKeys.has(key) ? NodeType.JUNCTION : NodeType.CORRIDOR;
      const nodeId = await createNodeHelper(type, coords);
      nodeMap.set(key, nodeId);
      nodeCoordsMap.set(nodeId, coords);
      createdNodeTypesMap.set(nodeId, type);
    }

    const connections: [string, string][] = [];

    // Process each skeleton edge and interpolate waypoints every 3m
    for (const [p1, p2] of centerlineEdges) {
      const k1 = getVertexKey(p1);
      const k2 = getVertexKey(p2);

      const pt1 = turf.point(p1);
      const pt2 = turf.point(p2);
      const len = turf.distance(pt1, pt2, { units: 'meters' });

      let prevNodeId = nodeMap.get(k1)!;
      const steps = Math.floor(len / 3.0);

      for (let i = 1; i <= steps; i++) {
        const dist = i * 3.0;
        if (dist < len - 0.5) {
          const interpolated = turf.along(
            turf.lineString([p1, p2]),
            dist,
            { units: 'meters' },
          );
          const coords = interpolated.geometry.coordinates as [number, number];
          const kw = getVertexKey(coords);

          let wNodeId = nodeMap.get(kw);
          if (!wNodeId) {
            wNodeId = await createNodeHelper(NodeType.CORRIDOR, coords);
            nodeMap.set(kw, wNodeId);
            nodeCoordsMap.set(wNodeId, coords);
            createdNodeTypesMap.set(wNodeId, NodeType.CORRIDOR);
          }

          connections.push([prevNodeId, wNodeId]);
          prevNodeId = wNodeId;
        }
      }

      const lastNodeId = nodeMap.get(k2)!;
      connections.push([prevNodeId, lastNodeId]);
    }

    // --- Step 4: Edge Generation ---
    const edgesToCreate: { fromNodeId: string; toNodeId: string; distance: number }[] = [];

    // 1. Accumulate Corridor-to-Corridor Edges
    const uniqueEdges = new Set<string>();
    for (const [idA, idB] of connections) {
      const edgeKey = [idA, idB].sort().join('||');
      if (uniqueEdges.has(edgeKey)) continue;
      uniqueEdges.add(edgeKey);

      const coordsA = nodeCoordsMap.get(idA)!;
      const coordsB = nodeCoordsMap.get(idB)!;
      const distance = turf.distance(turf.point(coordsA), turf.point(coordsB), {
        units: 'meters',
      });

      edgesToCreate.push(
        { fromNodeId: idA, toNodeId: idB, distance },
        { fromNodeId: idB, toNodeId: idA, distance },
      );
    }

    // 2. Connect Rooms to Doors
    const doors = await this.prisma.door.findMany({
      where: { floorId, active: true },
    });

    for (const door of doors) {
      const doorNodeId = door.nodeId;
      if (!doorNodeId) continue;

      const doorCoords = doorNodeCoordsMap.get(doorNodeId);
      if (!doorCoords) continue;

      // Connect doorNode to roomA
      if (door.roomAId) {
        const roomNodeId = roomNodeMap.get(door.roomAId);
        const roomCoords = roomCoordsMap.get(door.roomAId);
        if (roomNodeId && roomCoords) {
          const dist = turf.distance(
            turf.point(doorCoords),
            turf.point(roomCoords),
            { units: 'meters' },
          );
          edgesToCreate.push(
            { fromNodeId: roomNodeId, toNodeId: doorNodeId, distance: dist },
            { fromNodeId: doorNodeId, toNodeId: roomNodeId, distance: dist },
          );
        }
      }

      // Connect doorNode to roomB
      if (door.roomBId) {
        const roomNodeId = roomNodeMap.get(door.roomBId);
        const roomCoords = roomCoordsMap.get(door.roomBId);
        if (roomNodeId && roomCoords) {
          const dist = turf.distance(
            turf.point(doorCoords),
            turf.point(roomCoords),
            { units: 'meters' },
          );
          edgesToCreate.push(
            { fromNodeId: roomNodeId, toNodeId: doorNodeId, distance: dist },
            { fromNodeId: doorNodeId, toNodeId: roomNodeId, distance: dist },
          );
        }
      }

      // 3. Connect Door to nearest corridor node
      let minDistance = Infinity;
      let nearestCorridorId: string | null = null;

      for (const [cNodeId, cCoords] of nodeCoordsMap.entries()) {
        const type = createdNodeTypesMap.get(cNodeId);
        if (type !== NodeType.CORRIDOR && type !== NodeType.JUNCTION) continue;

        const dist = turf.distance(
          turf.point(doorCoords),
          turf.point(cCoords),
          { units: 'meters' },
        );
        if (dist < minDistance) {
          minDistance = dist;
          nearestCorridorId = cNodeId;
        }
      }

      if (nearestCorridorId) {
        edgesToCreate.push(
          {
            fromNodeId: doorNodeId,
            toNodeId: nearestCorridorId,
            distance: minDistance,
          },
          {
            fromNodeId: nearestCorridorId,
            toNodeId: doorNodeId,
            distance: minDistance,
          },
        );
      }
    }

    // 4. Batch persist all generated edges
    if (edgesToCreate.length > 0) {
      await this.prisma.edge.createMany({
        data: edgesToCreate,
        skipDuplicates: true,
      });
    }
    // Retrieve final stats
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
