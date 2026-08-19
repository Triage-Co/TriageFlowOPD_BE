import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { CreateBoundaryDto } from './dto/create-boundary.dto';
import { UpdateBoundaryDto } from './dto/update-boundary.dto';
import { GeoService } from '../../../shared/geo/geo.service';
import { PrismaService } from '../../../shared/config/prisma.service';

@Injectable()
export class BoundaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geoService: GeoService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async create(createBoundaryDto: CreateBoundaryDto) {
    try {
      const data = await this.prisma.boundary.create({
        data: {
          floorId: createBoundaryDto.floorId,
          roomId: createBoundaryDto.roomId,
          areaId: createBoundaryDto.areaId,
          seqNo: createBoundaryDto.seqNo,
          boundaryType: createBoundaryDto.boundaryType,
          adjacentRoomId: createBoundaryDto.adjacentRoomId,
          hasWall: createBoundaryDto.hasWall,
          doorId: createBoundaryDto.doorId,
          label: createBoundaryDto.label,
        },
      });

      if (createBoundaryDto.lineGeom) {
        await this.geoService.updateGeom(
          'boundary',
          data.id,
          'lineGeom',
          createBoundaryDto.lineGeom,
        );
      }

      const line = createBoundaryDto.lineGeom
        ? await this.geoService.readGeom('boundary', data.id, 'lineGeom')
        : null;

      await this.clearBuildingCacheByFloorId(data.floorId);

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

  async findAll(params: {
    floorId?: string;
    roomId?: string;
    areaId?: string;
    standalone?: boolean;
  }) {
    try {
      const where: any = {};
      if (params.floorId) where.floorId = params.floorId;
      if (params.roomId) where.roomId = params.roomId;
      if (params.areaId) where.areaId = params.areaId;
      if (params.standalone) {
        where.roomId = null;
        where.areaId = null;
      }

      const data = await this.prisma.boundary.findMany({ where });

      const processedData = await Promise.all(
        data.map(async (boundary) => {
          const line = await this.geoService.readGeom(
            'boundary',
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
      const data = await this.prisma.boundary.findUnique({
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
        'boundary',
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

  async update(id: string, updateBoundaryDto: UpdateBoundaryDto) {
    try {
      const boundary = await this.prisma.boundary.findUnique({
        where: { id },
      });
      if (!boundary) {
        return {
          code: 404,
          message: `Không tìm thấy đường biên với id ${id}`,
          status: 'error',
        };
      }

      const data = await this.prisma.boundary.update({
        where: { id },
        data: {
          floorId: updateBoundaryDto.floorId,
          roomId: updateBoundaryDto.roomId,
          areaId: updateBoundaryDto.areaId,
          seqNo: updateBoundaryDto.seqNo,
          boundaryType: updateBoundaryDto.boundaryType,
          adjacentRoomId: updateBoundaryDto.adjacentRoomId,
          hasWall: updateBoundaryDto.hasWall,
          doorId: updateBoundaryDto.doorId,
          label: updateBoundaryDto.label,
        },
      });

      if (updateBoundaryDto.lineGeom) {
        await this.geoService.updateGeom(
          'boundary',
          data.id,
          'lineGeom',
          updateBoundaryDto.lineGeom,
        );
      }

      const line = await this.geoService.readGeom(
        'boundary',
        data.id,
        'lineGeom',
      );

      await this.clearBuildingCacheByFloorId(data.floorId);

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
      const boundary = await this.prisma.boundary.findUnique({
        where: { id },
      });
      if (!boundary) {
        return {
          code: 404,
          message: `Không tìm thấy đường biên với id ${id}`,
          status: 'error',
        };
      }

      await this.prisma.boundary.delete({
        where: { id },
      });

      await this.clearBuildingCacheByFloorId(boundary.floorId);

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
