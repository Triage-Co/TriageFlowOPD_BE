import {
  BadRequestException,
  ConflictException,
  Injectable,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { BoundaryType, Prisma } from '@prisma/client';
import * as turf from '@turf/turf';
import { PrismaService } from '../../../shared/config/prisma.service';
import { GeoService } from '../../../shared/geo/geo.service';
import {
  CreateBoundaryBatchItemDto,
  CreateRoomBatchItemDto,
  MapEditorBatchDto,
  UpdateBoundaryBatchItemDto,
  UpdateRoomBatchItemDto,
} from './dto/batch-map-editor.dto';
import { lineMidpoint, toGeoJsonString } from './dto/geojson.dto';

interface ValidationErrorItem {
  scope: 'room' | 'boundary';
  tempKey?: string;
  id?: string;
  message: string;
}

type TxClient = Prisma.TransactionClient;

@Injectable()
export class MapEditorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geoService: GeoService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async applyBatch(floorId: string, dto: MapEditorBatchDto) {
    const floor = await this.prisma.floor.findUnique({
      where: { id: floorId },
    });
    if (!floor) {
      throw new NotFoundException(`Không tìm thấy tầng với id ${floorId}`);
    }

    await this.validateBatch(floorId, dto);

    const roomIdMap: Record<string, string> = {};
    const boundaryIdMap: Record<string, string> = {};

    try {
      await this.prisma.$transaction(
        async (tx) => {
          await this.deleteBoundaries(tx, floorId, dto.boundaries.delete);
          await this.deleteRooms(tx, floorId, dto.rooms.delete);

          for (const item of dto.rooms.create) {
            const id = await this.createRoom(tx, floorId, item);
            roomIdMap[item.tempKey] = id;
          }

          for (const item of dto.rooms.update) {
            await this.updateRoom(tx, floorId, item);
          }

          for (const item of dto.boundaries.create) {
            const id = await this.createBoundary(tx, floorId, item, roomIdMap);
            boundaryIdMap[item.tempKey] = id;
          }

          for (const item of dto.boundaries.update) {
            await this.updateBoundary(tx, floorId, item);
          }
        },
        { timeout: 60000 },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          message: 'Mã phòng bị trùng trên cùng tầng',
          errors: [
            {
              scope: 'room',
              message: 'roomCode đã tồn tại trên tầng này',
            },
          ],
        });
      }
      throw error;
    }

    await this.cacheManager.del(`building_map:${floor.buildingId}`);

    return {
      roomIdMap,
      boundaryIdMap,
      counts: {
        roomsCreated: dto.rooms.create.length,
        roomsUpdated: dto.rooms.update.length,
        roomsDeleted: dto.rooms.delete.length,
        boundariesCreated: dto.boundaries.create.length,
        boundariesUpdated: dto.boundaries.update.length,
        boundariesDeleted: dto.boundaries.delete.length,
      },
    };
  }

  // ─── Validation ────────────────────────────────────────────────────────────

  private async validateBatch(floorId: string, dto: MapEditorBatchDto) {
    const errors: ValidationErrorItem[] = [];

    const existingRooms = await this.prisma.physicalRoom.findMany({
      where: { floorId },
      select: { id: true, roomCode: true, areaId: true },
    });
    const roomById = new Map(existingRooms.map((r) => [r.id, r]));
    const deleteRoomSet = new Set(dto.rooms.delete);

    const existingBoundaries = await this.prisma.boundary.findMany({
      where: { floorId },
      select: { id: true, roomId: true, boundaryType: true, doorId: true },
    });
    const boundaryById = new Map(existingBoundaries.map((b) => [b.id, b]));

    const areas = await this.prisma.area.findMany({
      where: { floorId },
      select: { id: true },
    });
    const areaIds = new Set(areas.map((a) => a.id));

    // Ownership checks
    for (const id of dto.rooms.delete) {
      if (!roomById.has(id)) {
        errors.push({
          scope: 'room',
          id,
          message: `Không tìm thấy phòng ${id} trên tầng này`,
        });
      }
    }
    for (const item of dto.rooms.update) {
      if (!roomById.has(item.id)) {
        errors.push({
          scope: 'room',
          id: item.id,
          message: `Không tìm thấy phòng ${item.id} trên tầng này`,
        });
      }
      if (item.areaId && !areaIds.has(item.areaId)) {
        errors.push({
          scope: 'room',
          id: item.id,
          message: `areaId ${item.areaId} không thuộc tầng này`,
        });
      }
    }
    for (const item of dto.rooms.create) {
      if (item.areaId && !areaIds.has(item.areaId)) {
        errors.push({
          scope: 'room',
          tempKey: item.tempKey,
          message: `areaId ${item.areaId} không thuộc tầng này`,
        });
      }
    }
    for (const id of dto.boundaries.delete) {
      if (!boundaryById.has(id)) {
        errors.push({
          scope: 'boundary',
          id,
          message: `Không tìm thấy đường biên ${id} trên tầng này`,
        });
      }
    }
    for (const item of dto.boundaries.update) {
      if (!boundaryById.has(item.id)) {
        errors.push({
          scope: 'boundary',
          id: item.id,
          message: `Không tìm thấy đường biên ${item.id} trên tầng này`,
        });
      }
    }

    // Clinical room links block delete
    if (dto.rooms.delete.length > 0) {
      const linked = await this.prisma.room.findMany({
        where: { physical_room_id: { in: dto.rooms.delete } },
        select: { room_id: true, room_name: true, physical_room_id: true },
      });
      for (const r of linked) {
        errors.push({
          scope: 'room',
          id: r.physical_room_id!,
          message: `Không thể xoá: phòng khám "${r.room_name}" đang liên kết`,
        });
      }
    }

    // roomCode uniqueness across create + update + remaining existing
    const codeOwners = new Map<string, string>();
    for (const r of existingRooms) {
      if (!deleteRoomSet.has(r.id)) {
        codeOwners.set(r.roomCode.toLowerCase(), r.id);
      }
    }
    for (const item of dto.rooms.update) {
      if (!item.roomCode) continue;
      const key = item.roomCode.toLowerCase();
      const owner = codeOwners.get(key);
      if (owner && owner !== item.id) {
        errors.push({
          scope: 'room',
          id: item.id,
          message: `roomCode "${item.roomCode}" bị trùng trên tầng`,
        });
      }
      codeOwners.set(key, item.id);
    }
    for (const item of dto.rooms.create) {
      const key = item.roomCode.toLowerCase();
      if (codeOwners.has(key)) {
        errors.push({
          scope: 'room',
          tempKey: item.tempKey,
          message: `roomCode "${item.roomCode}" bị trùng trên tầng`,
        });
      }
      codeOwners.set(key, item.tempKey);
    }

    // Geometry validation for rooms
    const floorOutline = (await this.geoService.readGeom(
      'floor',
      floorId,
      'outlineGeom',
    )) as GeoJSON.Polygon | null;

    type RoomPoly = {
      key: string;
      id?: string;
      tempKey?: string;
      poly: GeoJSON.Feature<GeoJSON.Polygon>;
    };
    const finalRoomPolys: RoomPoly[] = [];

    // Existing rooms not deleted and not fully replaced by update outline
    for (const r of existingRooms) {
      if (deleteRoomSet.has(r.id)) continue;
      const update = dto.rooms.update.find((u) => u.id === r.id);
      if (update?.outlineGeom) continue;
      const outline = (await this.geoService.readGeom(
        'physical_room',
        r.id,
        'outlineGeom',
      )) as GeoJSON.Polygon | null;
      if (outline) {
        finalRoomPolys.push({
          key: r.id,
          id: r.id,
          poly: turf.polygon(outline.coordinates),
        });
      }
    }

    const validateRoomPolygon = (
      outline: { type: string; coordinates: number[][][] },
      ref: { tempKey?: string; id?: string },
    ): GeoJSON.Feature<GeoJSON.Polygon> | null => {
      let poly: GeoJSON.Feature<GeoJSON.Polygon>;
      try {
        poly = turf.polygon(outline.coordinates);
      } catch {
        errors.push({
          scope: 'room',
          ...ref,
          message: 'Polygon phòng không hợp lệ',
        });
        return null;
      }

      const kinks = turf.kinks(poly);
      if (kinks.features.length > 0) {
        errors.push({
          scope: 'room',
          ...ref,
          message: 'Polygon phòng bị tự cắt',
        });
      }

      const area = turf.area(poly);
      if (area < 1) {
        errors.push({
          scope: 'room',
          ...ref,
          message: `Diện tích phòng quá nhỏ (${area.toFixed(2)} m², tối thiểu 1 m²)`,
        });
      }

      if (floorOutline) {
        try {
          const floorPoly = turf.polygon(floorOutline.coordinates);
          if (!turf.booleanContains(floorPoly, poly)) {
            errors.push({
              scope: 'room',
              ...ref,
              message: 'Phòng phải nằm trong outline tầng',
            });
          }
        } catch {
          // ignore floor outline parse issues
        }
      }

      return poly;
    };

    for (const item of dto.rooms.create) {
      const poly = validateRoomPolygon(item.outlineGeom, {
        tempKey: item.tempKey,
      });
      if (poly) {
        finalRoomPolys.push({
          key: item.tempKey,
          tempKey: item.tempKey,
          poly,
        });
      }
    }
    for (const item of dto.rooms.update) {
      if (!item.outlineGeom) continue;
      const poly = validateRoomPolygon(item.outlineGeom, { id: item.id });
      if (poly) {
        finalRoomPolys.push({ key: item.id, id: item.id, poly });
      }
    }

    // Overlap between final rooms
    for (let i = 0; i < finalRoomPolys.length; i++) {
      for (let j = i + 1; j < finalRoomPolys.length; j++) {
        const a = finalRoomPolys[i];
        const b = finalRoomPolys[j];
        try {
          const inter = turf.intersect(
            turf.featureCollection([a.poly, b.poly]),
          );
          if (inter && turf.area(inter) > 0.05) {
            errors.push({
              scope: 'room',
              tempKey: a.tempKey,
              id: a.id,
              message: `Phòng chồng lấn với phòng khác (${b.tempKey || b.id})`,
            });
          }
        } catch {
          // turf.intersect can fail on invalid geometry already reported
        }
      }
    }

    // Boundary length + DOOR-on-WALL checks
    const wallSegments: {
      a: [number, number];
      b: [number, number];
    }[] = [];

    const collectWall = (
      coords: [[number, number], [number, number]],
      ref: { tempKey?: string; id?: string },
    ) => {
      const len = turf.distance(turf.point(coords[0]), turf.point(coords[1]), {
        units: 'meters',
      });
      if (len < 0.1) {
        errors.push({
          scope: 'boundary',
          ...ref,
          message: `Đoạn biên quá ngắn (${len.toFixed(3)} m, tối thiểu 0.1 m)`,
        });
        return;
      }
      wallSegments.push({ a: coords[0], b: coords[1] });
    };

    // Existing walls not deleted / not type-changed away from WALL
    const deleteBoundarySet = new Set(dto.boundaries.delete);
    for (const b of existingBoundaries) {
      if (deleteBoundarySet.has(b.id)) continue;
      const update = dto.boundaries.update.find((u) => u.id === b.id);
      const type = update?.boundaryType ?? b.boundaryType;
      if (type !== BoundaryType.WALL) continue;
      if (update?.lineGeom) {
        collectWall(update.lineGeom.coordinates, { id: b.id });
      } else {
        const line = (await this.geoService.readGeom(
          'boundary',
          b.id,
          'lineGeom',
        )) as GeoJSON.LineString | null;
        if (line && line.coordinates.length >= 2) {
          collectWall(
            [
              line.coordinates[0] as [number, number],
              line.coordinates[1] as [number, number],
            ],
            { id: b.id },
          );
        }
      }
    }
    for (const item of dto.boundaries.create) {
      if (item.boundaryType === BoundaryType.WALL) {
        collectWall(item.lineGeom.coordinates, { tempKey: item.tempKey });
      } else {
        const len = turf.distance(
          turf.point(item.lineGeom.coordinates[0]),
          turf.point(item.lineGeom.coordinates[1]),
          { units: 'meters' },
        );
        if (len < 0.1) {
          errors.push({
            scope: 'boundary',
            tempKey: item.tempKey,
            message: `Đoạn biên quá ngắn (${len.toFixed(3)} m)`,
          });
        }
      }

      if (
        item.roomId &&
        !roomById.has(item.roomId) &&
        !deleteRoomSet.has(item.roomId)
      ) {
        // roomId must exist unless it's being created via roomTempKey
        if (!item.roomTempKey) {
          errors.push({
            scope: 'boundary',
            tempKey: item.tempKey,
            message: `roomId ${item.roomId} không tồn tại trên tầng`,
          });
        }
      }
      if (item.roomId && deleteRoomSet.has(item.roomId) && !item.roomTempKey) {
        errors.push({
          scope: 'boundary',
          tempKey: item.tempKey,
          message: `roomId ${item.roomId} đang bị xoá trong cùng batch`,
        });
      }
    }
    for (const item of dto.boundaries.update) {
      if (item.lineGeom) {
        const len = turf.distance(
          turf.point(item.lineGeom.coordinates[0]),
          turf.point(item.lineGeom.coordinates[1]),
          { units: 'meters' },
        );
        if (len < 0.1) {
          errors.push({
            scope: 'boundary',
            id: item.id,
            message: `Đoạn biên quá ngắn (${len.toFixed(3)} m)`,
          });
        }
        const existing = boundaryById.get(item.id);
        const type = item.boundaryType ?? existing?.boundaryType;
        if (type === BoundaryType.WALL) {
          // already collected above when type is WALL
        }
      }
    }

    const checkDoorOnWall = (
      coords: [[number, number], [number, number]],
      ref: { tempKey?: string; id?: string },
    ) => {
      const mid = lineMidpoint(coords);
      const doorLen = turf.distance(
        turf.point(coords[0]),
        turf.point(coords[1]),
        {
          units: 'meters',
        },
      );
      let minDist = Infinity;
      let hostLen = 0;
      for (const wall of wallSegments) {
        const d = this.pointToSegmentDistanceMeters(mid, wall.a, wall.b);
        if (d < minDist) {
          minDist = d;
          hostLen = turf.distance(turf.point(wall.a), turf.point(wall.b), {
            units: 'meters',
          });
        }
      }
      if (wallSegments.length === 0 || minDist > 0.5) {
        errors.push({
          scope: 'boundary',
          ...ref,
          message: `Cửa phải nằm trên một tường (khoảng cách ${minDist === Infinity ? '∞' : minDist.toFixed(2)} m > 0.5 m)`,
        });
      } else if (doorLen > hostLen + 0.01) {
        errors.push({
          scope: 'boundary',
          ...ref,
          message: `Độ dài cửa (${doorLen.toFixed(2)} m) vượt quá tường chứa (${hostLen.toFixed(2)} m)`,
        });
      }
    };

    for (const item of dto.boundaries.create) {
      if (item.boundaryType === BoundaryType.DOOR) {
        checkDoorOnWall(item.lineGeom.coordinates, { tempKey: item.tempKey });
      }
    }
    for (const item of dto.boundaries.update) {
      const existing = boundaryById.get(item.id);
      const type = item.boundaryType ?? existing?.boundaryType;
      if (type !== BoundaryType.DOOR) continue;
      if (item.lineGeom) {
        checkDoorOnWall(item.lineGeom.coordinates, { id: item.id });
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Dữ liệu bản đồ không hợp lệ',
        errors,
      });
    }
  }

  private pointToSegmentDistanceMeters(
    p: [number, number],
    a: [number, number],
    b: [number, number],
  ): number {
    // Project in local meters approx
    const DEG_X = 111320;
    const DEG_Z = 110540;
    const px = p[0] * DEG_X;
    const pz = p[1] * DEG_Z;
    const ax = a[0] * DEG_X;
    const az = a[1] * DEG_Z;
    const bx = b[0] * DEG_X;
    const bz = b[1] * DEG_Z;
    const dx = bx - ax;
    const dz = bz - az;
    const lenSq = dx * dx + dz * dz;
    if (lenSq === 0) {
      return Math.sqrt((px - ax) ** 2 + (pz - az) ** 2);
    }
    let t = ((px - ax) * dx + (pz - az) * dz) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = ax + t * dx;
    const projZ = az + t * dz;
    return Math.sqrt((px - projX) ** 2 + (pz - projZ) ** 2);
  }

  // ─── Mutations ─────────────────────────────────────────────────────────────

  private async deleteBoundaries(tx: TxClient, floorId: string, ids: string[]) {
    if (ids.length === 0) return;

    const boundaries = await tx.boundary.findMany({
      where: { id: { in: ids }, floorId },
      select: { id: true, doorId: true, boundaryType: true },
    });

    const doorIds = boundaries.filter((b) => b.doorId).map((b) => b.doorId!);

    await tx.boundary.deleteMany({
      where: { id: { in: ids }, floorId },
    });

    if (doorIds.length > 0) {
      await this.deleteDoorsAndNodes(tx, doorIds);
    }
  }

  private async deleteRooms(tx: TxClient, floorId: string, ids: string[]) {
    if (ids.length === 0) return;

    // Boundaries cascade via onDelete: Cascade, but Door does not cascade from room
    const doors = await tx.door.findMany({
      where: {
        floorId,
        OR: [{ roomAId: { in: ids } }, { roomBId: { in: ids } }],
      },
      select: { id: true },
    });
    const doorIds = doors.map((d) => d.id);

    // Explicitly delete room-owned boundaries first to collect doorIds from DOOR boundaries
    const roomBoundaries = await tx.boundary.findMany({
      where: { roomId: { in: ids }, floorId },
      select: { id: true, doorId: true },
    });
    for (const b of roomBoundaries) {
      if (b.doorId && !doorIds.includes(b.doorId)) {
        doorIds.push(b.doorId);
      }
    }

    await tx.boundary.deleteMany({
      where: { roomId: { in: ids }, floorId },
    });

    if (doorIds.length > 0) {
      await this.deleteDoorsAndNodes(tx, doorIds);
    }

    await tx.physicalRoom.deleteMany({
      where: { id: { in: ids }, floorId },
    });
  }

  private async deleteDoorsAndNodes(tx: TxClient, doorIds: string[]) {
    const doors = await tx.door.findMany({
      where: { id: { in: doorIds } },
      select: { id: true, nodeId: true },
    });
    const nodeIds = doors
      .map((d) => d.nodeId)
      .filter((id): id is string => !!id);

    // Unlink boundaries still pointing at these doors
    await tx.boundary.updateMany({
      where: { doorId: { in: doorIds } },
      data: { doorId: null },
    });

    if (nodeIds.length > 0) {
      await tx.edge.deleteMany({
        where: {
          OR: [{ fromNodeId: { in: nodeIds } }, { toNodeId: { in: nodeIds } }],
        },
      });
      await tx.node.deleteMany({ where: { id: { in: nodeIds } } });
    }

    await tx.door.deleteMany({ where: { id: { in: doorIds } } });
  }

  private async createRoom(
    tx: TxClient,
    floorId: string,
    item: CreateRoomBatchItemDto,
  ): Promise<string> {
    const room = await tx.physicalRoom.create({
      data: {
        floorId,
        roomCode: item.roomCode,
        roomLabel: item.roomLabel,
        heightMeters: item.heightMeters,
        areaId: item.areaId,
      },
    });

    await this.geoService.updateGeom(
      'physical_room',
      room.id,
      'outlineGeom',
      toGeoJsonString(item.outlineGeom),
      tx,
    );
    await this.geoService.updateGeom(
      'physical_room',
      room.id,
      'centerGeom',
      toGeoJsonString(item.centerGeom),
      tx,
    );

    return room.id;
  }

  private async updateRoom(
    tx: TxClient,
    floorId: string,
    item: UpdateRoomBatchItemDto,
  ) {
    await tx.physicalRoom.update({
      where: { id: item.id },
      data: {
        ...(item.roomCode !== undefined ? { roomCode: item.roomCode } : {}),
        ...(item.roomLabel !== undefined ? { roomLabel: item.roomLabel } : {}),
        ...(item.heightMeters !== undefined
          ? { heightMeters: item.heightMeters }
          : {}),
        ...(item.areaId !== undefined ? { areaId: item.areaId } : {}),
      },
    });

    if (item.outlineGeom) {
      await this.geoService.updateGeom(
        'physical_room',
        item.id,
        'outlineGeom',
        toGeoJsonString(item.outlineGeom),
        tx,
      );
    }
    if (item.centerGeom) {
      await this.geoService.updateGeom(
        'physical_room',
        item.id,
        'centerGeom',
        toGeoJsonString(item.centerGeom),
        tx,
      );
    }

    // silence unused
    void floorId;
  }

  private async createBoundary(
    tx: TxClient,
    floorId: string,
    item: CreateBoundaryBatchItemDto,
    roomIdMap: Record<string, string>,
  ): Promise<string> {
    let roomId = item.roomId ?? null;
    if (item.roomTempKey) {
      roomId = roomIdMap[item.roomTempKey] ?? roomId;
      if (!roomId) {
        throw new BadRequestException({
          message: 'roomTempKey không resolve được',
          errors: [
            {
              scope: 'boundary',
              tempKey: item.tempKey,
              message: `Không tìm thấy phòng tạm ${item.roomTempKey}`,
            },
          ],
        });
      }
    }

    let areaId: string | null = null;
    if (roomId) {
      const room = await tx.physicalRoom.findUnique({
        where: { id: roomId },
        select: { areaId: true },
      });
      areaId = room?.areaId ?? null;
    }

    let doorId: string | null = null;
    if (item.boundaryType === BoundaryType.DOOR) {
      doorId = await this.createDoorForBoundary(
        tx,
        floorId,
        roomId,
        areaId,
        item.lineGeom.coordinates,
      );
    }

    const boundary = await tx.boundary.create({
      data: {
        floorId,
        roomId,
        areaId: null,
        seqNo: item.seqNo,
        boundaryType: item.boundaryType,
        hasWall: item.hasWall,
        label: item.label,
        doorId,
      },
    });

    await this.geoService.updateGeom(
      'boundary',
      boundary.id,
      'lineGeom',
      toGeoJsonString(item.lineGeom),
      tx,
    );

    return boundary.id;
  }

  private async updateBoundary(
    tx: TxClient,
    floorId: string,
    item: UpdateBoundaryBatchItemDto,
  ) {
    const existing = await tx.boundary.findUnique({ where: { id: item.id } });
    if (!existing || existing.floorId !== floorId) {
      throw new NotFoundException(`Không tìm thấy đường biên ${item.id}`);
    }

    const nextType = item.boundaryType ?? existing.boundaryType;
    let doorId = existing.doorId;

    // Type changed away from DOOR → delete linked door
    if (
      existing.boundaryType === BoundaryType.DOOR &&
      nextType !== BoundaryType.DOOR &&
      doorId
    ) {
      await this.deleteDoorsAndNodes(tx, [doorId]);
      doorId = null;
    }

    // Type changed to DOOR → create door
    if (
      existing.boundaryType !== BoundaryType.DOOR &&
      nextType === BoundaryType.DOOR
    ) {
      let coords: [[number, number], [number, number]] | null = null;
      if (item.lineGeom) {
        coords = item.lineGeom.coordinates;
      } else {
        const line = (await this.geoService.readGeom(
          'boundary',
          item.id,
          'lineGeom',
          tx,
        )) as GeoJSON.LineString | null;
        if (line && line.coordinates.length >= 2) {
          coords = [
            line.coordinates[0] as [number, number],
            line.coordinates[1] as [number, number],
          ];
        }
      }
      if (coords) {
        doorId = await this.createDoorForBoundary(
          tx,
          floorId,
          existing.roomId,
          existing.areaId,
          coords,
        );
      }
    }

    // Update door position if DOOR lineGeom changed
    if (
      nextType === BoundaryType.DOOR &&
      item.lineGeom &&
      doorId &&
      existing.boundaryType === BoundaryType.DOOR
    ) {
      const mid = lineMidpoint(item.lineGeom.coordinates);
      await this.geoService.updateGeom(
        'door',
        doorId,
        'positionGeom',
        this.geoService.toWKT(mid[0], mid[1]),
        tx,
      );
    }

    await tx.boundary.update({
      where: { id: item.id },
      data: {
        ...(item.seqNo !== undefined ? { seqNo: item.seqNo } : {}),
        ...(item.boundaryType !== undefined
          ? { boundaryType: item.boundaryType }
          : {}),
        ...(item.hasWall !== undefined ? { hasWall: item.hasWall } : {}),
        ...(item.label !== undefined ? { label: item.label } : {}),
        doorId,
      },
    });

    if (item.lineGeom) {
      await this.geoService.updateGeom(
        'boundary',
        item.id,
        'lineGeom',
        toGeoJsonString(item.lineGeom),
        tx,
      );
    }
  }

  private async createDoorForBoundary(
    tx: TxClient,
    floorId: string,
    roomId: string | null,
    areaId: string | null,
    coords: [[number, number], [number, number]],
  ): Promise<string> {
    const door = await tx.door.create({
      data: {
        floorId,
        roomAId: roomId,
        areaId,
        isAccessible: true,
        isEmergency: false,
        active: true,
      },
    });
    const mid = lineMidpoint(coords);
    await this.geoService.updateGeom(
      'door',
      door.id,
      'positionGeom',
      this.geoService.toWKT(mid[0], mid[1]),
      tx,
    );
    return door.id;
  }
}
