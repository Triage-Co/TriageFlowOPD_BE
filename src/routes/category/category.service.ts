import { Injectable } from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { PrismaService } from '../../shared/config/prisma.service';
import { Prisma } from '@prisma/client';


@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) { }

  async create(createCategoryDto: CreateCategoryDto) {
    try {
      const data = await this.prisma.category.create({
        data: {
          name: createCategoryDto.name,
          nameLocalized:
            createCategoryDto.nameLocalized as Prisma.InputJsonValue,
          icon: createCategoryDto.icon,
          sortOrder: createCategoryDto.sortOrder,
        },
      });
      return {
        code: 201,
        message: 'Thêm danh mục thành công',
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
      const data = await this.prisma.category.findMany({
        orderBy: { sortOrder: 'asc' },
      });
      return {
        code: 200,
        message: 'Lấy danh sách danh mục thành công',
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
      const data = await this.prisma.category.findUnique({
        where: { id },
      });
      if (!data) {
        return {
          code: 404,
          message: `Không tìm thấy danh mục với id ${id}`,
          status: 'error',
        };
      }
      return {
        code: 200,
        message: 'Lấy thông tin danh mục thành công',
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

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    try {
      const category = await this.prisma.category.findUnique({
        where: { id },
      });
      if (!category) {
        return {
          code: 404,
          message: `Không tìm thấy danh mục với id ${id}`,
          status: 'error',
        };
      }
      const data = await this.prisma.category.update({
        where: { id },
        data: {
          name: updateCategoryDto.name,
          nameLocalized:
            updateCategoryDto.nameLocalized as Prisma.InputJsonValue,
          icon: updateCategoryDto.icon,
          sortOrder: updateCategoryDto.sortOrder,
        },
      });
      return {
        code: 200,
        message: 'Cập nhật danh mục thành công',
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
      const category = await this.prisma.category.findUnique({
        where: { id },
      });
      if (!category) {
        return {
          code: 404,
          message: `Không tìm thấy danh mục với id ${id}`,
          status: 'error',
        };
      }
      await this.prisma.category.delete({
        where: { id },
      });
      return {
        code: 200,
        message: 'Xóa danh mục thành công',
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
