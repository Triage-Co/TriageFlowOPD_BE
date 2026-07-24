import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';
import { GeoService } from '../../../shared/geo/geo.service';
import { PrismaService } from '../../../shared/config/prisma.service';

@Injectable()
export class AreaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geoService: GeoService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async create(createAreaDto: CreateAreaDto) {
    try {
      const data = await this.prisma.area.create({
        data: {
          floorId: createAreaDto.floorId,
          areaCode: createAreaDto.areaCode,
          areaLabel: createAreaDto.areaLabel,
          description: createAreaDto.description,
        },
      });

      if (createAreaDto.centerGeom) {
        await this.geoService.updateGeom(
          'area',
          data.id,
          'centerGeom',
          createAreaDto.centerGeom,
        );
      }

      if (createAreaDto.outlineGeom) {
        await this.geoService.updateGeom(
          'area',
          data.id,
          'outlineGeom',
          createAreaDto.outlineGeom,
        );
      }

      const center = createAreaDto.centerGeom
        ? await this.geoService.readGeom('area', data.id, 'centerGeom')
        : null;

      const outline = createAreaDto.outlineGeom
        ? await this.geoService.readGeom('area', data.id, 'outlineGeom')
        : null;

      await this.clearBuildingCacheByFloorId(data.floorId);

      return {
        code: 201,
        message: 'Thêm khu vực thành công',
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
      const data = await this.prisma.area.findMany({
        where: floorId ? { floorId } : {},
      });

      const processedData = await Promise.all(
        data.map(async (area) => {
          const center = await this.geoService.readGeom(
            'area',
            area.id,
            'centerGeom',
          );
          const outline = await this.geoService.readGeom(
            'area',
            area.id,
            'outlineGeom',
          );
          return { ...area, centerGeom: center, outlineGeom: outline };
        }),
      );

      return {
        code: 200,
        message: 'Lấy danh sách khu vực thành công',
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
      const data = await this.prisma.area.findUnique({
        where: { id },
      });
      if (!data) {
        return {
          code: 404,
          message: `Không tìm thấy khu vực với id ${id}`,
          status: 'error',
        };
      }

      const center = await this.geoService.readGeom('area', data.id, 'centerGeom');
      const outline = await this.geoService.readGeom('area', data.id, 'outlineGeom');

      return {
        code: 200,
        message: 'Lấy thông tin khu vực thành công',
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

  async update(id: string, updateAreaDto: UpdateAreaDto) {
    try {
      const area = await this.prisma.area.findUnique({
        where: { id },
      });
      if (!area) {
        return {
          code: 404,
          message: `Không tìm thấy khu vực với id ${id}`,
          status: 'error',
        };
      }

      const data = await this.prisma.area.update({
        where: { id },
        data: {
          floorId: updateAreaDto.floorId,
          areaCode: updateAreaDto.areaCode,
          areaLabel: updateAreaDto.areaLabel,
          description: updateAreaDto.description,
        },
      });

      if (updateAreaDto.centerGeom) {
        await this.geoService.updateGeom(
          'area',
          data.id,
          'centerGeom',
          updateAreaDto.centerGeom,
        );
      }

      if (updateAreaDto.outlineGeom) {
        await this.geoService.updateGeom(
          'area',
          data.id,
          'outlineGeom',
          updateAreaDto.outlineGeom,
        );
      }

      const center = await this.geoService.readGeom('area', data.id, 'centerGeom');
      const outline = await this.geoService.readGeom('area', data.id, 'outlineGeom');

      await this.clearBuildingCacheByFloorId(data.floorId);

      return {
        code: 200,
        message: 'Cập nhật khu vực thành công',
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
      const area = await this.prisma.area.findUnique({
        where: { id },
      });
      if (!area) {
        return {
          code: 404,
          message: `Không tìm thấy khu vực với id ${id}`,
          status: 'error',
        };
      }

      await this.prisma.area.delete({
        where: { id },
      });

      await this.clearBuildingCacheByFloorId(area.floorId);

      return {
        code: 200,
        message: 'Xóa khu vực thành công',
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
    }
  }
}
