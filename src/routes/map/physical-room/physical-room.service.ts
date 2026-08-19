import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { CreatePhysicalRoomDto } from './dto/create-physical-room.dto';
import { UpdatePhysicalRoomDto } from './dto/update-physical-room.dto';
import { GeoService } from '../../../shared/geo/geo.service';
import { PrismaService } from '../../../shared/config/prisma.service';

@Injectable()
export class PhysicalRoomService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geoService: GeoService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async create(createPhysicalRoomDto: CreatePhysicalRoomDto) {
    try {
      const data = await this.prisma.physicalRoom.create({
        data: {
          floorId: createPhysicalRoomDto.floorId,
          roomCode: createPhysicalRoomDto.roomCode,
          roomLabel: createPhysicalRoomDto.roomLabel,
          heightMeters: createPhysicalRoomDto.heightMeters,
          areaId: createPhysicalRoomDto.areaId,
        },
      });

      if (createPhysicalRoomDto.centerGeom) {
        await this.geoService.updateGeom(
          'physical_room',
          data.id,
          'centerGeom',
          createPhysicalRoomDto.centerGeom,
        );
      }

      if (createPhysicalRoomDto.outlineGeom) {
        await this.geoService.updateGeom(
          'physical_room',
          data.id,
          'outlineGeom',
          createPhysicalRoomDto.outlineGeom,
        );
      }

      const center = createPhysicalRoomDto.centerGeom
        ? await this.geoService.readGeom('physical_room', data.id, 'centerGeom')
        : null;

      const outline = createPhysicalRoomDto.outlineGeom
        ? await this.geoService.readGeom(
            'physical_room',
            data.id,
            'outlineGeom',
          )
        : null;

      await this.clearBuildingCacheByFloorId(data.floorId);

      return {
        code: 201,
        message: 'Thêm phòng thành công',
        status: 'success',
        data: { ...data, centerGeom: center, outlineGeom: outline },
      };
    } catch (error) {
      return {
        code: 500,
        message: error instanceof Error ? error.message : 'Unknown Error',
        status: 'error',
      };
    }
  }

  async findAll(floorId?: string) {
    try {
      const data = await this.prisma.physicalRoom.findMany({
        where: floorId ? { floorId } : {},
      });

      const processedData = await Promise.all(
        data.map(async (room) => {
          const center = await this.geoService.readGeom(
            'physical_room',
            room.id,
            'centerGeom',
          );
          const outline = await this.geoService.readGeom(
            'physical_room',
            room.id,
            'outlineGeom',
          );
          return { ...room, centerGeom: center, outlineGeom: outline };
        }),
      );

      return {
        code: 200,
        message: 'Lấy danh sách phòng thành công',
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
      const data = await this.prisma.physicalRoom.findUnique({
        where: { id },
      });
      if (!data) {
        return {
          code: 404,
          message: `Không tìm thấy phòng với id ${id}`,
          status: 'error',
        };
      }

      const center = await this.geoService.readGeom(
        'physical_room',
        data.id,
        'centerGeom',
      );
      const outline = await this.geoService.readGeom(
        'physical_room',
        data.id,
        'outlineGeom',
      );

      return {
        code: 200,
        message: 'Lấy thông tin phòng thành công',
        status: 'success',
        data: { ...data, centerGeom: center, outlineGeom: outline },
      };
    } catch (error) {
      return {
        code: 500,
        message: error instanceof Error ? error.message : 'Unknown Error',
        status: 'error',
      };
    }
  }

  async update(id: string, updatePhysicalRoomDto: UpdatePhysicalRoomDto) {
    try {
      const room = await this.prisma.physicalRoom.findUnique({
        where: { id },
      });
      if (!room) {
        return {
          code: 404,
          message: `Không tìm thấy phòng với id ${id}`,
          status: 'error',
        };
      }

      const data = await this.prisma.physicalRoom.update({
        where: { id },
        data: {
          floorId: updatePhysicalRoomDto.floorId,
          roomCode: updatePhysicalRoomDto.roomCode,
          roomLabel: updatePhysicalRoomDto.roomLabel,
          heightMeters: updatePhysicalRoomDto.heightMeters,
          areaId: updatePhysicalRoomDto.areaId,
        },
      });

      if (updatePhysicalRoomDto.centerGeom) {
        await this.geoService.updateGeom(
          'physical_room',
          data.id,
          'centerGeom',
          updatePhysicalRoomDto.centerGeom,
        );
      }

      if (updatePhysicalRoomDto.outlineGeom) {
        await this.geoService.updateGeom(
          'physical_room',
          data.id,
          'outlineGeom',
          updatePhysicalRoomDto.outlineGeom,
        );
      }

      const center = await this.geoService.readGeom(
        'physical_room',
        data.id,
        'centerGeom',
      );
      const outline = await this.geoService.readGeom(
        'physical_room',
        data.id,
        'outlineGeom',
      );

      await this.clearBuildingCacheByFloorId(data.floorId);

      return {
        code: 200,
        message: 'Cập nhật phòng thành công',
        status: 'success',
        data: { ...data, centerGeom: center, outlineGeom: outline },
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
      const room = await this.prisma.physicalRoom.findUnique({
        where: { id },
      });
      if (!room) {
        return {
          code: 404,
          message: `Không tìm thấy phòng với id ${id}`,
          status: 'error',
        };
      }
      await this.prisma.physicalRoom.delete({
        where: { id },
      });
      await this.clearBuildingCacheByFloorId(room.floorId);
      return {
        code: 200,
        message: 'Xóa phòng thành công',
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

  private async clearBuildingCacheByFloorId(floorId: string) {
    const floor = await this.prisma.floor.findUnique({
      where: { id: floorId },
      select: { buildingId: true },
    });
    if (floor) {
      await this.cacheManager.del(`building_map:${floor.buildingId}`);
      await this.cacheManager.del(`nav_graph:${floor.buildingId}`);
    }
  }
}
