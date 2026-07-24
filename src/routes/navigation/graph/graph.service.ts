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

    await this.prisma.node.deleteMany({
      where: { floorId },
    });

    const roomFeatures = await this.geoService.readAllGeoms(
      'physical_room',
      floorId,
      'outlineGeom',
    );

    const roomNodeMap = new Map<string, string>();
    const roomCoordsMap = new Map<string, [number, number]>();

    for (const roomFeature of roomFeatures) {
      const poly = roomFeature.geometry;
      if (!poly || (poly.type !== 'Polygon' && poly.type !== 'MultiPolygon')) {
        continue;
      }

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
      const node = await this.createNode(
        floorId,
        NodeType.ROOM_ENTRANCE,
        coords,
        { roomId },
      );

      roomNodeMap.set(roomId, node.id);
      roomCoordsMap.set(roomId, coords);
    }

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
      } else {
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

    const exploded = turf.explode(walkable);
    const uniquePointsMap = new Map<string, any>();
    for (const feature of exploded.features) {
      const c = feature.geometry.coordinates;
      const key = `${c[0].toFixed(6)}_${c[1].toFixed(6)}`;
      uniquePointsMap.set(key, feature);
    }
    const uniquePoints = Array.from(uniquePointsMap.values());

    const bbox = turf.bbox(walkable);
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
        if (intersects.features.length > 0) {
          return false;
        }
        const mid = turf.midpoint(turf.point(p1), turf.point(p2));
        if (turf.booleanPointInPolygon(mid, roomPoly)) {
          return false;
        }
      }
      return true;
    };

    const centerlineEdges: [[number, number], [number, number]][] = [];
    for (const [p1, p2] of voronoiEdges) {
      const pt1 = turf.point(p1);
      const pt2 = turf.point(p2);
      const midPoint = turf.midpoint(pt1, pt2);
      const midCoord = midPoint.geometry.coordinates as [number, number];

      if (!isInsideWalkable(p1) || !isInsideWalkable(p2) || !isInsideWalkable(midCoord)) {
        continue;
      }

      if (!hasLineOfSight(p1, p2)) {
        continue;
      }

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

    const nodeMap = new Map<string, string>();
    const nodeCoordsMap = new Map<string, [number, number]>();
    const createdNodeTypesMap = new Map<string, NodeType>();

    for (const [key, coords] of keyToCoords.entries()) {
      const type = junctionKeys.has(key) ? NodeType.JUNCTION : NodeType.CORRIDOR;
      const node = await this.createNode(floorId, type, coords);
      nodeMap.set(key, node.id);
      nodeCoordsMap.set(node.id, coords);
      createdNodeTypesMap.set(node.id, type);
    }

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
            const sampleNode = await this.createNode(floorId, NodeType.CORRIDOR, sampleCoords);
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

    const edgesToCreate: { fromNodeId: string; toNodeId: string; distance: number }[] = [];
    const uniqueEdges = new Set<string>();

    for (const [fromNodeId, toNodeId] of corridorConnections) {
      const edgeKey = [fromNodeId, toNodeId].sort().join('||');
      if (uniqueEdges.has(edgeKey)) continue;
      uniqueEdges.add(edgeKey);
      const coordsA = nodeCoordsMap.get(fromNodeId)!;
      const coordsB = nodeCoordsMap.get(toNodeId)!;
      const distance = turf.distance(turf.point(coordsA), turf.point(coordsB), { units: 'meters' });
      edgesToCreate.push(
        { fromNodeId, toNodeId, distance },
        { fromNodeId: toNodeId, toNodeId: fromNodeId, distance },
      );
    }

    const doors = await this.prisma.door.findMany({
      where: { floorId, active: true },
    });

    for (const door of doors) {
      const doorNodeId = door.nodeId;
      if (!doorNodeId) continue;
      const doorCoords = doorNodeCoordsMap.get(doorNodeId);
      if (!doorCoords) continue;

      let nearestCorridorId: string | null = null;
      let minDistance = Infinity;
      for (const [cNodeId, cCoords] of nodeCoordsMap.entries()) {
        const type = createdNodeTypesMap.get(cNodeId);
        if (type !== NodeType.CORRIDOR && type !== NodeType.JUNCTION) continue;

        // Verify straight line of sight to door (no wall intersection)
        if (!hasLineOfSight(doorCoords, cCoords)) continue;

        const distance = turf.distance(turf.point(doorCoords), turf.point(cCoords), { units: 'meters' });
        if (distance < minDistance) {
          minDistance = distance;
          nearestCorridorId = cNodeId;
        }
      }

      if (nearestCorridorId) {
        edgesToCreate.push(
          { fromNodeId: doorNodeId, toNodeId: nearestCorridorId, distance: minDistance },
          { fromNodeId: nearestCorridorId, toNodeId: doorNodeId, distance: minDistance },
        );
      }
    }

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
