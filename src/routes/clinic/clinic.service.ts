import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { UpdateClinicDto } from './dto/update-clinic.dto';
import { GeoService } from '../../shared/geo/geo.service';
import { PrismaService } from '../../shared/config/prisma.service';

@Injectable()
export class ClinicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geoService: GeoService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async create(createClinicDto: CreateClinicDto) {
    try {
      const data = await this.prisma.clinic.create({
        data: {
          floorId: createClinicDto.floorId,
          clinicCode: createClinicDto.clinicCode,
          clinicLabel: createClinicDto.clinicLabel,
          description: createClinicDto.description,
        },
      });

      if (createClinicDto.centerGeom) {
        await this.geoService.updateGeom(
          'clinic',
          data.id,
          'centerGeom',
          createClinicDto.centerGeom,
        );
      }

      if (createClinicDto.outlineGeom) {
        await this.geoService.updateGeom(
          'clinic',
          data.id,
          'outlineGeom',
          createClinicDto.outlineGeom,
        );
      }

      const center = createClinicDto.centerGeom
        ? await this.geoService.readGeom('clinic', data.id, 'centerGeom')
        : null;

      const outline = createClinicDto.outlineGeom
        ? await this.geoService.readGeom('clinic', data.id, 'outlineGeom')
        : null;

      await this.clearBuildingCacheByFloorId(data.floorId);

      return {
        code: 201,
        message: 'Thêm khu khám thành công',
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
      const data = await this.prisma.clinic.findMany({
        where: floorId ? { floorId } : {},
      });

      const processedData = await Promise.all(
        data.map(async (clinic) => {
          const center = await this.geoService.readGeom(
            'clinic',
            clinic.id,
            'centerGeom',
          );
          const outline = await this.geoService.readGeom(
            'clinic',
            clinic.id,
            'outlineGeom',
          );
          return { ...clinic, centerGeom: center, outlineGeom: outline };
        }),
      );

      return {
        code: 200,
        message: 'Lấy danh sách khu khám thành công',
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
      const data = await this.prisma.clinic.findUnique({
        where: { id },
      });
      if (!data) {
        return {
          code: 404,
          message: `Không tìm thấy khu khám với id ${id}`,
          status: 'error',
        };
      }

      const center = await this.geoService.readGeom('clinic', data.id, 'centerGeom');
      const outline = await this.geoService.readGeom('clinic', data.id, 'outlineGeom');

      return {
        code: 200,
        message: 'Lấy thông tin khu khám thành công',
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

  async update(id: string, updateClinicDto: UpdateClinicDto) {
    try {
      const clinic = await this.prisma.clinic.findUnique({
        where: { id },
      });
      if (!clinic) {
        return {
          code: 404,
          message: `Không tìm thấy khu khám với id ${id}`,
          status: 'error',
        };
      }

      const data = await this.prisma.clinic.update({
        where: { id },
        data: {
          floorId: updateClinicDto.floorId,
          clinicCode: updateClinicDto.clinicCode,
          clinicLabel: updateClinicDto.clinicLabel,
          description: updateClinicDto.description,
        },
      });

      if (updateClinicDto.centerGeom) {
        await this.geoService.updateGeom(
          'clinic',
          data.id,
          'centerGeom',
          updateClinicDto.centerGeom,
        );
      }

      if (updateClinicDto.outlineGeom) {
        await this.geoService.updateGeom(
          'clinic',
          data.id,
          'outlineGeom',
          updateClinicDto.outlineGeom,
        );
      }

      const center = await this.geoService.readGeom('clinic', data.id, 'centerGeom');
      const outline = await this.geoService.readGeom('clinic', data.id, 'outlineGeom');

      await this.clearBuildingCacheByFloorId(data.floorId);

      return {
        code: 200,
        message: 'Cập nhật khu khám thành công',
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
      const clinic = await this.prisma.clinic.findUnique({
        where: { id },
      });
      if (!clinic) {
        return {
          code: 404,
          message: `Không tìm thấy khu khám với id ${id}`,
          status: 'error',
        };
      }

      await this.prisma.clinic.delete({
        where: { id },
      });

      await this.clearBuildingCacheByFloorId(clinic.floorId);

      return {
        code: 200,
        message: 'Xóa khu khám thành công',
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
