import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../../../shared/config/prisma.service';
import { GeoService } from '../../../shared/geo/geo.service';
import * as turf from '@turf/turf';
import { NodeType, ConnectorType } from '@prisma/client';
import { Polygon, MultiPolygon } from 'geojson';
import { generateDoorNodes } from '../core/graph-generation/doors';
import { generateCorridorNodes } from '../core/graph-generation/corridors';
import { generateGraphEdges } from '../core/graph-generation/edges';
import { readGeom } from '../core/graph-generation/utils';
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

  async clearAllNodes(floorId: string) {
    const floor = await this.prisma.floor.findUnique({ where: { id: floorId } });
    if (!floor) throw new NotFoundException(`Floor with ID ${floorId} not found`);

    await this.prisma.$executeRawUnsafe(`
      SET statement_timeout = 120000;
      DELETE FROM "node" WHERE "floorId" = '${floorId}';
    `);
    await this.cacheManager.del(`building_map:${floor.buildingId}`);
    return { cleared: true };
  }

  async generateDoorsPhase(floorId: string) {
    const floor = await this.prisma.floor.findUnique({ where: { id: floorId } });
    if (!floor) throw new NotFoundException(`Floor with ID ${floorId} not found`);

    await this.clearAllNodes(floorId);

    // Explicitly cast this.prisma to any to bypass strict type checking when passing to external script
    const { doorNodeCoordsMap } = await generateDoorNodes(this.prisma as any, floorId);

    await this.cacheManager.del(`building_map:${floor.buildingId}`);
    return { doorsGenerated: doorNodeCoordsMap.size };
  }

  async generateCorridorsPhase(floorId: string) {
    const floor = await this.prisma.floor.findUnique({ where: { id: floorId } });
    if (!floor) throw new NotFoundException(`Floor with ID ${floorId} not found`);

    await this.clearAllNodes(floorId);
    await generateDoorNodes(this.prisma as any, floorId);

    const floorOutlineGeoJSON = await readGeom(this.prisma as any, 'floor', floorId, 'outlineGeom');
    if (!floorOutlineGeoJSON) throw new BadRequestException('Floor has no outline geometry defined');

    const corridorData = await generateCorridorNodes(this.prisma as any, floorId, floorOutlineGeoJSON);

    await this.cacheManager.del(`building_map:${floor.buildingId}`);
    return { corridorsGenerated: corridorData.nodeMap.size };
  }

  async getCorridorDebugSteps(floorId: string) {
    const floor = await this.prisma.floor.findUnique({ where: { id: floorId } });
    if (!floor) throw new NotFoundException(`Floor with ID ${floorId} not found`);

    const floorOutlineGeoJSON = await readGeom(this.prisma as any, 'floor', floorId, 'outlineGeom');
    if (!floorOutlineGeoJSON) throw new BadRequestException('Floor has no outline geometry defined');

    const corridorData = await generateCorridorNodes(this.prisma as any, floorId, floorOutlineGeoJSON);

    const pbPoints = (corridorData.uniquePoints || []).map((feat: any) => feat.geometry.coordinates);
    const tinEdges = corridorData.tinEdges || [];
    const zigzagEdges = corridorData.candidateEdges || [];
    const pmidPoints = corridorData.finalNodeCoords || [];

    return {
      pbPoints,
      tinEdges,
      zigzagEdges,
      pmidPoints,
    };
  }

  async generateEdgesPhase(floorId: string) {
    return await this.generateGraph(floorId);
  }

  /**
   * Deterministically generate the navigation graph for a given floor.
   * This is equivalent to running the full algorithm (doors -> corridors -> edges).
   */
  /**
   * Deterministically generate the navigation graph for a given floor using MPRSSEM (v3).
   * Middle-Point Relation Structure Segment Entrance Modification.
   */
  async generateGraph(floorId: string) {
    const startTime = Date.now();

    const floor = await this.prisma.floor.findUnique({ where: { id: floorId } });
    if (!floor) throw new NotFoundException(`Floor with ID ${floorId} not found`);

    const floorOutlineGeoJSON = await readGeom(this.prisma as any, 'floor', floorId, 'outlineGeom');
    const { doorNodeCoordsMap } = await generateDoorNodes(this.prisma as any, floorId);
    const corridorData = await generateCorridorNodes(this.prisma as any, floorId, floorOutlineGeoJSON);
    await generateGraphEdges(this.prisma as any, floorId, doorNodeCoordsMap, corridorData);

    const totalNodes = await this.prisma.node.count({ where: { floorId } });
    const totalEdges = await this.prisma.edge.count({ where: { fromNode: { floorId } } });

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
