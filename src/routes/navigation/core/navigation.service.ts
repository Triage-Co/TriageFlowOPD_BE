import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../../../shared/config/prisma.service';
import { GeoService } from '../../../shared/geo/geo.service';
import { GetRouteDto, RouteLocationType } from './dto/get-route.dto';
import * as turf from '@turf/turf';
import { get3DMapHtml } from './navigation-3d.template';

@Injectable()
export class NavigationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geoService: GeoService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) { }

  /**
   * Get the complete map layout of a building, with caching.
   */
  async getBuildingMap(buildingId: string) {
    const cacheKey = `building_map:${buildingId}`;

    // 1. Check cache first
    const cachedMap = await this.cacheManager.get(cacheKey);
    if (cachedMap) {
      return cachedMap;
    }

    // 2. Query building details
    const building = await this.prisma.building.findUnique({
      where: { id: buildingId },
    });
    if (!building) {
      throw new NotFoundException(`Không tìm thấy tòa nhà với ID ${buildingId}`);
    }

    // 3. Query all Floors for this building
    const floors = await this.prisma.floor.findMany({
      where: { buildingId },
      orderBy: { floorNumber: 'asc' },
    });

    const floorMaps = await Promise.all(
      floors.map(async (floor) => {
        // Read floor outline geom
        const outlineGeom = await this.geoService.readGeom('floor', floor.id, 'outlineGeom');

        // Query rooms on this floor
        const rooms = await this.prisma.physicalRoom.findMany({
          where: { floorId: floor.id },
        });

        const roomMaps = await Promise.all(
          rooms.map(async (room) => {
            const centerGeom = await this.geoService.readGeom('physical_room', room.id, 'centerGeom');
            const outlineGeomRoom = await this.geoService.readGeom('physical_room', room.id, 'outlineGeom');

            // Query boundaries for this room
            const boundaries = await this.prisma.boundary.findMany({
              where: { roomId: room.id },
              orderBy: { seqNo: 'asc' },
            });

            const boundaryMaps = await Promise.all(
              boundaries.map(async (boundary) => {
                const lineGeom = await this.geoService.readGeom('boundary', boundary.id, 'lineGeom');
                return {
                  ...boundary,
                  lineGeom,
                };
              }),
            );

            // Query POIs for this room
            const pois = await this.prisma.poi.findMany({
              where: { roomId: room.id, active: true },
              include: {
                category: {
                  select: {
                    name: true,
                    icon: true,
                  },
                },
              },
            });

            return {
              ...room,
              centerGeom,
              outlineGeom: outlineGeomRoom,
              boundaries: boundaryMaps,
              pois,
            };
          }),
        );

        // Query doors on this floor
        const doors = await this.prisma.door.findMany({
          where: { floorId: floor.id, active: true },
        });

        const doorMaps = await Promise.all(
          doors.map(async (door) => {
            const positionGeom = await this.geoService.readGeom('door', door.id, 'positionGeom');
            return {
              ...door,
              positionGeom,
            };
          }),
        );

        // Query areas on this floor
        const areas = await this.prisma.area.findMany({
          where: { floorId: floor.id },
        });

        const areaMaps = await Promise.all(
          areas.map(async (area) => {
            const centerGeom = await this.geoService.readGeom('area', area.id, 'centerGeom');
            const outlineGeomArea = await this.geoService.readGeom('area', area.id, 'outlineGeom');

            // Query boundaries for this area
            const boundaries = await this.prisma.boundary.findMany({
              where: { areaId: area.id },
              orderBy: { seqNo: 'asc' },
            });

            const boundaryMaps = await Promise.all(
              boundaries.map(async (boundary) => {
                const lineGeom = await this.geoService.readGeom('boundary', boundary.id, 'lineGeom');
                return {
                  ...boundary,
                  lineGeom,
                };
              }),
            );

            return {
              ...area,
              centerGeom,
              outlineGeom: outlineGeomArea,
              boundaries: boundaryMaps,
            };
          }),
        );

        // Query standalone boundaries on this floor (neither room nor area)
        const standaloneBoundaries = await this.prisma.boundary.findMany({
          where: { floorId: floor.id, roomId: null, areaId: null },
          orderBy: { seqNo: 'asc' },
        });

        const standaloneBoundaryMaps = await Promise.all(
          standaloneBoundaries.map(async (boundary) => {
            const lineGeom = await this.geoService.readGeom('boundary', boundary.id, 'lineGeom');
            return {
              ...boundary,
              lineGeom,
            };
          }),
        );

        const nodeFeatures = await this.geoService.readAllGeoms('node', floor.id, 'coordsGeom');
        const nodeMaps = nodeFeatures
          .filter((feature) => feature.properties.active !== false)
          .map((feature) => ({
            id: feature.properties.id,
            type: feature.properties.type,
            active: feature.properties.active,
            metadata: feature.properties.metadata,
            coordsGeom: feature.geometry,
          }));

        return {
          ...floor,
          outlineGeom,
          rooms: roomMaps,
          doors: doorMaps,
          areas: areaMaps,
          standaloneBoundaries: standaloneBoundaryMaps,
          nodes: nodeMaps,
        };
      }),
    );

    const resultMap = {
      building,
      floors: floorMaps,
    };

    // 4. Cache the mapped layout for 1 hour (3600000 ms or as cache-manager config)
    await this.cacheManager.set(cacheKey, resultMap, 3600000);

    return resultMap;
  }

  /**
   * Run A* Pathfinding to calculate the shortest path.
   */
  async findRoute(dto: GetRouteDto) {
    // 1. Resolve start node
    const startNode = await this.resolveNode(dto.startType, dto.startId);
    // 2. Resolve target node
    const targetNode = await this.resolveNode(dto.targetType, dto.targetId);

    if (startNode.floorId === targetNode.floorId && startNode.id === targetNode.id) {
      return {
        totalDistance: 0,
        path: [startNode],
      };
    }

    // 3. Find the buildingId of these nodes
    const startFloor = await this.prisma.floor.findUnique({
      where: { id: startNode.floorId },
      select: { buildingId: true },
    });
    if (!startFloor) {
      throw new NotFoundException(`Không tìm thấy tầng chứa điểm xuất phát`);
    }

    const buildingId = startFloor.buildingId;

    // 4. Fetch all floors of this building
    const floors = await this.prisma.floor.findMany({
      where: { buildingId },
      select: { id: true, floorNumber: true },
    });
    const floorIds = floors.map((f) => f.id);
    const floorMap = new Map<string, number>(floors.map((f) => [f.id, f.floorNumber]));

    // 5. Fetch all nodes with coordinates in this building
    const nodesList: any[] = [];
    for (const floor of floors) {
      const nodeFeatures = await this.geoService.readAllGeoms('node', floor.id, 'coordsGeom');
      for (const feature of nodeFeatures) {
        if (feature.properties.active !== false) {
          nodesList.push({
            id: feature.properties.id,
            type: feature.properties.type,
            coords: feature.geometry ? feature.geometry.coordinates : null,
            metadata: feature.properties.metadata,
            floorId: floor.id,
            floorNumber: floor.floorNumber,
          });
        }
      }
    }

    const nodesMap = new Map<string, any>(nodesList.map((n) => [n.id, n]));

    // Check if start & target nodes are loaded in our nodesMap
    const fullStartNode = nodesMap.get(startNode.id);
    const fullTargetNode = nodesMap.get(targetNode.id);
    if (!fullStartNode || !fullTargetNode) {
      throw new BadRequestException('Điểm bắt đầu hoặc điểm đích không nằm trong cùng đồ thị tòa nhà');
    }

    // 6. Fetch all edges connecting these active nodes
    const nodeIds = nodesList.map((n) => n.id);
    const edges = await this.prisma.edge.findMany({
      where: {
        fromNodeId: { in: nodeIds },
        toNodeId: { in: nodeIds },
        active: true,
      },
    });

    // 7. Build adjacency list representation of the graph
    const adjacencyList = new Map<string, { toNodeId: string; distance: number }[]>();
    for (const id of nodeIds) {
      adjacencyList.set(id, []);
    }
    for (const edge of edges) {
      adjacencyList.get(edge.fromNodeId)?.push({
        toNodeId: edge.toNodeId,
        distance: edge.distance,
      });
    }

    // 8. Run A* Pathfinding
    const pathIds = this.runAStar(
      fullStartNode.id,
      fullTargetNode.id,
      nodesMap,
      adjacencyList,
    );

    if (!pathIds) {
      throw new BadRequestException('Không tìm thấy đường đi giữa hai địa điểm này');
    }

    // 9. Map path IDs back to node structures
    const pathNodes = pathIds.map((id) => nodesMap.get(id)!);

    // Calculate total cost
    let totalDistance = 0;
    for (let i = 0; i < pathNodes.length - 1; i++) {
      const from = pathNodes[i];
      const to = pathNodes[i + 1];
      const neighbors = adjacencyList.get(from.id) || [];
      const edgeInfo = neighbors.find((n) => n.toNodeId === to.id);
      totalDistance += edgeInfo ? edgeInfo.distance : 0;
    }

    return {
      totalDistance,
      path: pathNodes,
    };
  }

  /**
   * Resolve Location Input to an active routing Node.
   */
  private async resolveNode(type: RouteLocationType, id: string): Promise<any> {
    if (type === RouteLocationType.NODE) {
      const node = await this.prisma.node.findUnique({
        where: { id, active: true },
      });
      if (!node) {
        throw new NotFoundException(`Không tìm thấy node đồ thị với ID ${id}`);
      }
      return node;
    }

    if (type === RouteLocationType.ROOM) {
      const room = await this.prisma.physicalRoom.findUnique({
        where: { id },
      });
      if (!room) {
        throw new NotFoundException(`Không tìm thấy phòng với ID ${id}`);
      }

      // 1. Prioritize Door Node linked to this room
      const door = await this.prisma.door.findFirst({
        where: {
          floorId: room.floorId,
          OR: [{ roomAId: id }, { roomBId: id }],
          nodeId: { not: null },
          active: true,
        },
      });

      if (door && door.nodeId) {
        const doorNode = await this.prisma.node.findUnique({
          where: { id: door.nodeId, active: true },
        });
        if (doorNode) return doorNode;
      }

      // 2. Fallback: Find node on this floor where metadata.roomId = room.id
      const nodes = await this.prisma.node.findMany({
        where: { floorId: room.floorId, active: true },
      });

      const roomNode = nodes.find((n) => {
        const meta = n.metadata as any;
        return meta && meta.roomId === id;
      });

      if (!roomNode) {
        throw new NotFoundException(`Không tìm thấy node chỉ đường tương ứng cho phòng ${room.roomLabel}`);
      }
      return roomNode;
    }

    if (type === RouteLocationType.POI) {
      const poi = await this.prisma.poi.findUnique({
        where: { id, active: true },
      });
      if (!poi) {
        throw new NotFoundException(`Không tìm thấy điểm POI với ID ${id}`);
      }

      const room = await this.prisma.physicalRoom.findUnique({
        where: { id: poi.roomId },
      });
      if (!room) {
        throw new NotFoundException(`Không tìm thấy phòng chứa POI này`);
      }

      // 1. Prioritize Door Node linked to POI's room
      const door = await this.prisma.door.findFirst({
        where: {
          floorId: room.floorId,
          OR: [{ roomAId: room.id }, { roomBId: room.id }],
          nodeId: { not: null },
          active: true,
        },
      });

      if (door && door.nodeId) {
        const doorNode = await this.prisma.node.findUnique({
          where: { id: door.nodeId, active: true },
        });
        if (doorNode) return doorNode;
      }

      // 2. Fallback: Find node on this floor where metadata.roomId = room.id
      const nodes = await this.prisma.node.findMany({
        where: { floorId: room.floorId, active: true },
      });

      const roomNode = nodes.find((n) => {
        const meta = n.metadata as any;
        return meta && meta.roomId === room.id;
      });

      if (!roomNode) {
        throw new NotFoundException(`Không tìm thấy node chỉ đường tương ứng cho POI ${poi.name}`);
      }
      return roomNode;
    }

    throw new BadRequestException(`Loại vị trí không hợp lệ: ${type}`);
  }

  /**
   * A* shortest path search algorithm.
   */
  private runAStar(
    startId: string,
    targetId: string,
    nodesMap: Map<string, any>,
    adjacencyList: Map<string, { toNodeId: string; distance: number }[]>,
  ): string[] | null {
    // Priority queue of nodes to explore, represented simply as an array sorted by fScore
    const openSet: string[] = [startId];
    const closedSet = new Set<string>();

    const cameFrom = new Map<string, string>();

    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();

    // Initialize scores
    for (const id of nodesMap.keys()) {
      gScore.set(id, Infinity);
      fScore.set(id, Infinity);
    }
    gScore.set(startId, 0);
    fScore.set(startId, this.calculateHeuristic(nodesMap.get(startId), nodesMap.get(targetId)));

    while (openSet.length > 0) {
      // Sort openSet by fScore in ascending order
      openSet.sort((a, b) => (fScore.get(a) || Infinity) - (fScore.get(b) || Infinity));
      const currentId = openSet.shift()!;

      if (currentId === targetId) {
        // Path found! Reconstruct it.
        const totalPath = [currentId];
        let curr = currentId;
        while (cameFrom.has(curr)) {
          curr = cameFrom.get(curr)!;
          totalPath.unshift(curr);
        }
        return totalPath;
      }

      closedSet.add(currentId);

      const neighbors = adjacencyList.get(currentId) || [];
      for (const neighbor of neighbors) {
        const neighborId = neighbor.toNodeId;
        if (closedSet.has(neighborId)) {
          continue;
        }

        const tentativeGScore = (gScore.get(currentId) || 0) + neighbor.distance;

        if (tentativeGScore < (gScore.get(neighborId) || Infinity)) {
          cameFrom.set(neighborId, currentId);
          gScore.set(neighborId, tentativeGScore);
          fScore.set(
            neighborId,
            tentativeGScore + this.calculateHeuristic(nodesMap.get(neighborId), nodesMap.get(targetId)),
          );

          if (!openSet.includes(neighborId)) {
            openSet.push(neighborId);
          }
        }
      }
    }

    return null; // Path not found
  }

  /**
   * A* Heuristic: Straight-line distance between two nodes (factoring in floor difference penalty).
   */
  private calculateHeuristic(nodeA: any, nodeB: any): number {
    if (!nodeA || !nodeB || !nodeA.coords || !nodeB.coords) {
      return 0;
    }
    // Haversine/geographic distance in meters
    const dist = turf.distance(
      turf.point(nodeA.coords),
      turf.point(nodeB.coords),
      { units: 'meters' },
    );
    // Vertical penalty: 4 meters height difference per floor
    const floorDiff = Math.abs(nodeA.floorNumber - nodeB.floorNumber);
    return dist + floorDiff * 4.0;
  }

  /**
   * Get 3D map view compiled with ThreeJS.
   */
  async getBuilding3dMap(buildingId: string): Promise<string> {
    const buildingMap = await this.getBuildingMap(buildingId);
    return get3DMapHtml(buildingMap);
  }
}

