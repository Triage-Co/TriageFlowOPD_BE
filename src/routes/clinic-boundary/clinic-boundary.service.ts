import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { CreateClinicBoundaryDto } from './dto/create-clinic-boundary.dto';
import { UpdateClinicBoundaryDto } from './dto/update-clinic-boundary.dto';
import { GeoService } from '../../shared/geo/geo.service';
import { PrismaService } from '../../shared/config/prisma.service';

@Injectable()
export class ClinicBoundaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geoService: GeoService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async create(createClinicBoundaryDto: CreateClinicBoundaryDto) {
    try {
      const data = await this.prisma.clinicBoundary.create({
        data: {
          clinicId: createClinicBoundaryDto.clinicId,
          seqNo: createClinicBoundaryDto.seqNo,
          boundaryType: createClinicBoundaryDto.boundaryType,
          hasWall: createClinicBoundaryDto.hasWall,
        },
      });

      if (createClinicBoundaryDto.lineGeom) {
        await this.geoService.updateGeom(
          'clinic_boundary',
          data.id,
          'lineGeom',
          createClinicBoundaryDto.lineGeom,
        );
      }

      const line = createClinicBoundaryDto.lineGeom
        ? await this.geoService.readGeom('clinic_boundary', data.id, 'lineGeom')
        : null;

      await this.clearBuildingCacheByClinicId(data.clinicId);

      return {
        code: 201,
        message: 'Thêm đường biên khu khám thành công',
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

  async findAll(clinicId?: string) {
    try {
      const data = await this.prisma.clinicBoundary.findMany({
        where: clinicId ? { clinicId } : {},
      });

      const processedData = await Promise.all(
        data.map(async (boundary) => {
          const line = await this.geoService.readGeom(
            'clinic_boundary',
            boundary.id,
            'lineGeom',
          );
          return { ...boundary, lineGeom: line };
        }),
      );

      return {
        code: 200,
        message: 'Lấy danh sách đường biên khu khám thành công',
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
      const data = await this.prisma.clinicBoundary.findUnique({
        where: { id },
      });
      if (!data) {
        return {
          code: 404,
          message: `Không tìm thấy đường biên khu khám với id ${id}`,
          status: 'error',
        };
      }

      const line = await this.geoService.readGeom('clinic_boundary', data.id, 'lineGeom');

      return {
        code: 200,
        message: 'Lấy thông tin đường biên khu khám thành công',
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

  async update(id: string, updateClinicBoundaryDto: UpdateClinicBoundaryDto) {
    try {
      const boundary = await this.prisma.clinicBoundary.findUnique({
        where: { id },
      });
      if (!boundary) {
        return {
          code: 404,
          message: `Không tìm thấy đường biên khu khám với id ${id}`,
          status: 'error',
        };
      }

      const data = await this.prisma.clinicBoundary.update({
        where: { id },
        data: {
          clinicId: updateClinicBoundaryDto.clinicId,
          seqNo: updateClinicBoundaryDto.seqNo,
          boundaryType: updateClinicBoundaryDto.boundaryType,
          hasWall: updateClinicBoundaryDto.hasWall,
        },
      });

      if (updateClinicBoundaryDto.lineGeom) {
        await this.geoService.updateGeom(
          'clinic_boundary',
          data.id,
          'lineGeom',
          updateClinicBoundaryDto.lineGeom,
        );
      }

      const line = await this.geoService.readGeom('clinic_boundary', data.id, 'lineGeom');

      await this.clearBuildingCacheByClinicId(data.clinicId);

      return {
        code: 200,
        message: 'Cập nhật đường biên khu khám thành công',
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
      const boundary = await this.prisma.clinicBoundary.findUnique({
        where: { id },
      });
      if (!boundary) {
        return {
          code: 404,
          message: `Không tìm thấy đường biên khu khám với id ${id}`,
          status: 'error',
        };
      }

      await this.prisma.clinicBoundary.delete({
        where: { id },
      });

      await this.clearBuildingCacheByClinicId(boundary.clinicId);

      return {
        code: 200,
        message: 'Xóa đường biên khu khám thành công',
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

  private async clearBuildingCacheByClinicId(clinicId: string) {
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { floorId: true },
    });
    if (clinic) {
      const floor = await this.prisma.floor.findUnique({
        where: { id: clinic.floorId },
        select: { buildingId: true },
      });
      if (floor) {
        await this.cacheManager.del(`building_map:${floor.buildingId}`);
      }
    }
  }
}
