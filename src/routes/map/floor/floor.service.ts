import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { CreateFloorDto } from './dto/create-floor.dto';
import { UpdateFloorDto } from './dto/update-floor.dto';
import { GeoService } from '../../../shared/geo/geo.service';
import { PrismaService } from '../../../shared/config/prisma.service';

@Injectable()
export class FloorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geoService: GeoService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async create(createFloorDto: CreateFloorDto) {
    try {
      const data = await this.prisma.floor.create({
        data: {
          buildingId: createFloorDto.buildingId,
          floorNumber: createFloorDto.floorNumber,
          floorPlanImageUrl: createFloorDto.floorPlanImageUrl,
          widthMeters: createFloorDto.widthMeters,
          heightMeters: createFloorDto.heightMeters,
          scalePixelsPerMeter: createFloorDto.scalePixelsPerMeter,
        },
      });

      if (createFloorDto.outlineGeom) {
        await this.geoService.updateGeom(
          'floor',
          data.id,
          'outlineGeom',
          createFloorDto.outlineGeom,
        );
      }

      const outline = createFloorDto.outlineGeom
        ? await this.geoService.readGeom('floor', data.id, 'outlineGeom')
        : null;

      await this.cacheManager.del(`building_map:${data.buildingId}`);
      await this.cacheManager.del(`nav_graph:${data.buildingId}`);

      return {
        code: 201,
        message: 'Thêm tầng thành công',
        status: 'success',
        data: { ...data, outlineGeom: outline },
      };
    } catch (error) {
      return {
        code: 500,
        message: error instanceof Error ? error.message : 'Unknown Error',
        status: 'error',
      };
    }
  }

  async findAll(buildingId?: string) {
    try {
      const data = await this.prisma.floor.findMany({
        where: buildingId ? { buildingId } : {},
      });

      const processedData = await Promise.all(
        data.map(async (floor) => {
          const outline = await this.geoService.readGeom(
            'floor',
            floor.id,
            'outlineGeom',
          );
          return { ...floor, outlineGeom: outline };
        }),
      );

      return {
        code: 200,
        message: 'Lấy danh sách tầng thành công',
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
      const data = await this.prisma.floor.findUnique({
        where: { id },
      });
      if (!data) {
        return {
          code: 404,
          message: `Không tìm thấy tầng với id ${id}`,
          status: 'error',
        };
      }

      const outline = await this.geoService.readGeom(
        'floor',
        data.id,
        'outlineGeom',
      );

      return {
        code: 200,
        message: 'Lấy thông tin tầng thành công',
        status: 'success',
        data: { ...data, outlineGeom: outline },
      };
    } catch (error) {
      return {
        code: 500,
        message: error instanceof Error ? error.message : 'Unknown Error',
        status: 'error',
      };
    }
  }

  async update(id: string, updateFloorDto: UpdateFloorDto) {
    try {
      const floor = await this.prisma.floor.findUnique({
        where: { id },
      });
      if (!floor) {
        return {
          code: 404,
          message: `Không tìm thấy tầng với id ${id}`,
          status: 'error',
        };
      }

      const data = await this.prisma.floor.update({
        where: { id },
        data: {
          buildingId: updateFloorDto.buildingId,
          floorNumber: updateFloorDto.floorNumber,
          floorPlanImageUrl: updateFloorDto.floorPlanImageUrl,
          widthMeters: updateFloorDto.widthMeters,
          heightMeters: updateFloorDto.heightMeters,
          scalePixelsPerMeter: updateFloorDto.scalePixelsPerMeter,
        },
      });

      if (updateFloorDto.outlineGeom) {
        await this.geoService.updateGeom(
          'floor',
          data.id,
          'outlineGeom',
          updateFloorDto.outlineGeom,
        );
      }

      const outline = await this.geoService.readGeom(
        'floor',
        data.id,
        'outlineGeom',
      );

      await this.cacheManager.del(`building_map:${data.buildingId}`);
      await this.cacheManager.del(`nav_graph:${data.buildingId}`);

      return {
        code: 200,
        message: 'Cập nhật tầng thành công',
        status: 'success',
        data: { ...data, outlineGeom: outline },
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
      const floor = await this.prisma.floor.findUnique({
        where: { id },
      });
      if (!floor) {
        return {
          code: 404,
          message: `Không tìm thấy tầng với id ${id}`,
          status: 'error',
        };
      }
      await this.prisma.floor.delete({
        where: { id },
      });
      await this.cacheManager.del(`building_map:${floor.buildingId}`);
      await this.cacheManager.del(`nav_graph:${floor.buildingId}`);
      return {
        code: 200,
        message: 'Xóa tầng thành công',
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
