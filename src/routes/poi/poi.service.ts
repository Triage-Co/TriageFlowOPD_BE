import { Injectable } from '@nestjs/common';
import { CreatePoiDto } from './dto/create-poi.dto';
import { UpdatePoiDto } from './dto/update-poi.dto';
import { PrismaConfig } from '../../shared/config/prisma.config';
import { Prisma } from '.prisma/client';

@Injectable()
export class PoiService {
  constructor(private readonly prisma: PrismaConfig) { }

  async create(createPoiDto: CreatePoiDto) {
    try {
      const data = await this.prisma.poi.create({
        data: {
          roomId: createPoiDto.roomId,
          categoryId: createPoiDto.categoryId,
          name: createPoiDto.name,
          nameLocalized: createPoiDto.nameLocalized as Prisma.InputJsonValue,
          description: createPoiDto.description,
          keywords: createPoiDto.keywords,
          logoUrl: createPoiDto.logoUrl,
          contactInfo: createPoiDto.contactInfo as Prisma.InputJsonValue,
          openingHours: createPoiDto.openingHours as Prisma.InputJsonValue,
          active: createPoiDto.active,
        },
      });
      return {
        code: 201,
        message: 'Thêm POI thành công',
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

  async findAll(roomId?: string, categoryId?: string) {
    try {
      const where: Prisma.PoiWhereInput = {};
      if (roomId) where.roomId = roomId;
      if (categoryId) where.categoryId = categoryId;

      const data = await this.prisma.poi.findMany({
        where,
        include: {
          category: {
            select: {
              name: true,
              icon: true,
            },
          },
        },
      });
      return {
        code: 200,
        message: 'Lấy danh sách POI thành công',
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
      const data = await this.prisma.poi.findUnique({
        where: { id },
        include: {
          category: {
            select: {
              name: true,
              icon: true,
            },
          },
        },
      });
      if (!data) {
        return {
          code: 404,
          message: `Không tìm thấy POI với id ${id}`,
          status: 'error',
        };
      }
      return {
        code: 200,
        message: 'Lấy thông tin POI thành công',
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

  async update(id: string, updatePoiDto: UpdatePoiDto) {
    try {
      const poi = await this.prisma.poi.findUnique({
        where: { id },
      });
      if (!poi) {
        return {
          code: 404,
          message: `Không tìm thấy POI với id ${id}`,
          status: 'error',
        };
      }
      const data = await this.prisma.poi.update({
        where: { id },
        data: {
          roomId: updatePoiDto.roomId,
          categoryId: updatePoiDto.categoryId,
          name: updatePoiDto.name,
          nameLocalized: updatePoiDto.nameLocalized as Prisma.InputJsonValue,
          description: updatePoiDto.description,
          keywords: updatePoiDto.keywords,
          logoUrl: updatePoiDto.logoUrl,
          contactInfo: updatePoiDto.contactInfo as Prisma.InputJsonValue,
          openingHours: updatePoiDto.openingHours as Prisma.InputJsonValue,
          active: updatePoiDto.active,
        },
      });
      return {
        code: 200,
        message: 'Cập nhật POI thành công',
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
      const poi = await this.prisma.poi.findUnique({
        where: { id },
      });
      if (!poi) {
        return {
          code: 404,
          message: `Không tìm thấy POI với id ${id}`,
          status: 'error',
        };
      }
      await this.prisma.poi.delete({
        where: { id },
      });
      return {
        code: 200,
        message: 'Xóa POI thành công',
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
