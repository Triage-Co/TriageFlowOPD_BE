import { Injectable } from '@nestjs/common';
import { CreatePhysicalRoomDto } from './dto/create-physical-room.dto';
import { UpdatePhysicalRoomDto } from './dto/update-physical-room.dto';
import { PrismaConfig } from '../../shared/config/prisma.config';
import { GeoService } from '../../shared/geo/geo.service';

@Injectable()
export class PhysicalRoomService {
  constructor(
    private readonly prisma: PrismaConfig,
    private readonly geoService: GeoService,
  ) {}

  async create(createPhysicalRoomDto: CreatePhysicalRoomDto) {
    try {
      const data = await this.prisma.physicalRoom.create({
        data: {
          floorId: createPhysicalRoomDto.floorId,
          roomCode: createPhysicalRoomDto.roomCode,
          roomLabel: createPhysicalRoomDto.roomLabel,
          type: createPhysicalRoomDto.type,
          heightMeters: createPhysicalRoomDto.heightMeters,
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
        ? await this.geoService.readGeom(
            'physical_room',
            data.id,
            'centerGeom',
          )
        : null;

      const outline = createPhysicalRoomDto.outlineGeom
        ? await this.geoService.readGeom(
            'physical_room',
            data.id,
            'outlineGeom',
          )
        : null;

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
          type: updatePhysicalRoomDto.type,
          heightMeters: updatePhysicalRoomDto.heightMeters,
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
}
