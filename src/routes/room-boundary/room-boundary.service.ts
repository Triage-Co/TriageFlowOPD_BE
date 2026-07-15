import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { CreateRoomBoundaryDto } from './dto/create-room-boundary.dto';
import { UpdateRoomBoundaryDto } from './dto/update-room-boundary.dto';
import { GeoService } from '../../shared/geo/geo.service';
import { PrismaService } from '../../shared/config/prisma.service';

@Injectable()
export class RoomBoundaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geoService: GeoService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) { }

  async create(createRoomBoundaryDto: CreateRoomBoundaryDto) {
    try {
      const data = await this.prisma.roomBoundary.create({
        data: {
          roomId: createRoomBoundaryDto.roomId,
          seqNo: createRoomBoundaryDto.seqNo,
          boundaryType: createRoomBoundaryDto.boundaryType,
          adjacentRoomId: createRoomBoundaryDto.adjacentRoomId,
          hasWall: createRoomBoundaryDto.hasWall,
          doorId: createRoomBoundaryDto.doorId,
        },
      });

      if (createRoomBoundaryDto.lineGeom) {
        await this.geoService.updateGeom(
          'room_boundary',
          data.id,
          'lineGeom',
          createRoomBoundaryDto.lineGeom,
        );
      }

      const line = createRoomBoundaryDto.lineGeom
        ? await this.geoService.readGeom('room_boundary', data.id, 'lineGeom')
        : null;

      await this.clearBuildingCacheByRoomId(data.roomId);

      return {
        code: 201,
        message: 'Thêm đường biên thành công',
        status: 'success',
        data: { ...data, lineGeom: line },
      };
    } catch (error) {
      return {
        code: 500,
        message: error instanceof Error ? error.message : 'Unknown Error',
        status: 'error',
      };
    }
  }

  async findAll(roomId?: string) {
    try {
      const data = await this.prisma.roomBoundary.findMany({
        where: roomId ? { roomId } : {},
      });

      const processedData = await Promise.all(
        data.map(async (boundary) => {
          const line = await this.geoService.readGeom(
            'room_boundary',
            boundary.id,
            'lineGeom',
          );
          return { ...boundary, lineGeom: line };
        }),
      );

      return {
        code: 200,
        message: 'Lấy danh sách đường biên thành công',
        status: 'success',
        data: processedData,
      };
    } catch (error) {
      return {
        code: 500,
        message: error instanceof Error ? error.message : 'Unknown Error',
        status: 'error',
      };
    }
  }

  async findOne(id: string) {
    try {
      const data = await this.prisma.roomBoundary.findUnique({
        where: { id },
      });
      if (!data) {
        return {
          code: 404,
          message: `Không tìm thấy đường biên với id ${id}`,
          status: 'error',
        };
      }

      const line = await this.geoService.readGeom(
        'room_boundary',
        data.id,
        'lineGeom',
      );

      return {
        code: 200,
        message: 'Lấy thông tin đường biên thành công',
        status: 'success',
        data: { ...data, lineGeom: line },
      };
    } catch (error) {
      return {
        code: 500,
        message: error instanceof Error ? error.message : 'Unknown Error',
        status: 'error',
      };
    }
  }

  async update(id: string, updateRoomBoundaryDto: UpdateRoomBoundaryDto) {
    try {
      const boundary = await this.prisma.roomBoundary.findUnique({
        where: { id },
      });
      if (!boundary) {
        return {
          code: 404,
          message: `Không tìm thấy đường biên với id ${id}`,
          status: 'error',
        };
      }

      const data = await this.prisma.roomBoundary.update({
        where: { id },
        data: {
          roomId: updateRoomBoundaryDto.roomId,
          seqNo: updateRoomBoundaryDto.seqNo,
          boundaryType: updateRoomBoundaryDto.boundaryType,
          adjacentRoomId: updateRoomBoundaryDto.adjacentRoomId,
          hasWall: updateRoomBoundaryDto.hasWall,
          doorId: updateRoomBoundaryDto.doorId,
        },
      });

      if (updateRoomBoundaryDto.lineGeom) {
        await this.geoService.updateGeom(
          'room_boundary',
          data.id,
          'lineGeom',
          updateRoomBoundaryDto.lineGeom,
        );
      }

      const line = await this.geoService.readGeom(
        'room_boundary',
        data.id,
        'lineGeom',
      );

      await this.clearBuildingCacheByRoomId(data.roomId);

      return {
        code: 200,
        message: 'Cập nhật đường biên thành công',
        status: 'success',
        data: { ...data, lineGeom: line },
      };
    } catch (error) {
      return {
        code: 500,
        message: error instanceof Error ? error.message : 'Unknown Error',
        status: 'error',
      };
    }
  }

  async remove(id: string) {
    try {
      const boundary = await this.prisma.roomBoundary.findUnique({
        where: { id },
      });
      if (!boundary) {
        return {
          code: 404,
          message: `Không tìm thấy đường biên với id ${id}`,
          status: 'error',
        };
      }
      await this.prisma.roomBoundary.delete({
        where: { id },
      });
      await this.clearBuildingCacheByRoomId(boundary.roomId);
      return {
        code: 200,
        message: 'Xóa đường biên thành công',
        status: 'success',
      };
    } catch (error) {
      return {
        code: 500,
        message: error instanceof Error ? error.message : 'Unknown Error',
        status: 'error',
      };
    }
  }

  private async clearBuildingCacheByRoomId(roomId: string) {
    const room = await this.prisma.physicalRoom.findUnique({
      where: { id: roomId },
      select: { floorId: true },
    });
    if (room) {
      const floor = await this.prisma.floor.findUnique({
        where: { id: room.floorId },
        select: { buildingId: true },
      });
      if (floor) {
        await this.cacheManager.del(`building_map:${floor.buildingId}`);
      }
    }
  }
}
