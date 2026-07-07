import { Injectable } from '@nestjs/common';
import { CreateSpecialtyDto } from './dto/request-specialty.dto';
import { UpdateSpecialtyDto } from './dto/response-specialty.dto';
import { PrismaConfig } from '../../shared/config/prisma.config';

@Injectable()
export class SpecialtyService {
  constructor(private readonly pismaClient: PrismaConfig) {}

  async create(createSpecialtyDto: CreateSpecialtyDto) {
    try {
      const data = await this.pismaClient.specialty.create({
        data: {
          name: createSpecialtyDto.name,
        },
      });
      return {
        code: 200,
        message: 'Thêm chuyên khoa thành công',
        status: 'success',
        data: data,
      };
    } catch (error) {
      return {
        code: 500,
        message: error,
        status: 'error',
      };
    }
  }

  async findAll() {
    try {
      const data = await this.pismaClient.specialty.findMany();
      return {
        code: 200,
        message: 'Tìm tất cả chuyên khoa thành công',
        status: 'success',
        data: data,
      };
    } catch (error) {
      return {
        code: 500,
        message: error,
        status: 'error',
      };
    }
  }
}
