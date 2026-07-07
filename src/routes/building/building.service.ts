import { Injectable } from '@nestjs/common';
import { CreateBuildingDto } from './dto/create-building.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';
import { PrismaConfig } from '../../shared/config/prisma.config';

@Injectable()
export class BuildingService {
  constructor(private readonly prisma: PrismaConfig) {}

  async create(createBuildingDto: CreateBuildingDto) {
    try {
      const data = await this.prisma.building.create({
        data: {
          name: createBuildingDto.name,
          addressLabel: createBuildingDto.addressLabel,
          totalFloors: createBuildingDto.totalFloors,
          organizationId: createBuildingDto.organizationId,
        },
      });
      return {
        code: 201,
        message: 'Thêm tòa nhà thành công',
        status: 'success',
        data,
      };
    } catch (error) {
      return {
        code: 500,
        message: error instanceof Error ? error.message : 'Unknown Error',
        status: 'error',
      };
    }
  }

  async findAll() {
    try {
      const data = await this.prisma.building.findMany();
      return {
        code: 200,
        message: 'Lấy danh sách tòa nhà thành công',
        status: 'success',
        data,
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
      const data = await this.prisma.building.findUnique({
        where: { id },
      });
      if (!data) {
        return {
          code: 404,
          message: `Không tìm thấy tòa nhà với id ${id}`,
          status: 'error',
        };
      }
      return {
        code: 200,
        message: 'Lấy thông tin tòa nhà thành công',
        status: 'success',
        data,
      };
    } catch (error) {
      return {
        code: 500,
        message: error instanceof Error ? error.message : 'Unknown Error',
        status: 'error',
      };
    }
  }

  async update(id: string, updateBuildingDto: UpdateBuildingDto) {
    try {
      const building = await this.prisma.building.findUnique({
        where: { id },
      });
      if (!building) {
        return {
          code: 404,
          message: `Không tìm thấy tòa nhà với id ${id}`,
          status: 'error',
        };
      }
      const data = await this.prisma.building.update({
        where: { id },
        data: {
          name: updateBuildingDto.name,
          addressLabel: updateBuildingDto.addressLabel,
          totalFloors: updateBuildingDto.totalFloors,
          organizationId: updateBuildingDto.organizationId,
        },
      });
      return {
        code: 200,
        message: 'Cập nhật tòa nhà thành công',
        status: 'success',
        data,
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
      const building = await this.prisma.building.findUnique({
        where: { id },
      });
      if (!building) {
        return {
          code: 404,
          message: `Không tìm thấy tòa nhà với id ${id}`,
          status: 'error',
        };
      }
      await this.prisma.building.delete({
        where: { id },
      });
      return {
        code: 200,
        message: 'Xóa tòa nhà thành công',
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
