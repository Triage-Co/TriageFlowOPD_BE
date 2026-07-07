import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateFlowDto } from './dto/request-flow.dto';
import { UpdateFlowDto } from './dto/update-flow.dto';
import { PrismaConfig } from '../../shared/config/prisma.config';

@Injectable()
export class FlowService {
  constructor(private readonly prismaClient: PrismaConfig) {}
  async create(createFlowDto: CreateFlowDto) {
    try {
      const data = await this.prismaClient.flow.create({
        data: {
          name: createFlowDto.name,
          userId: createFlowDto.userId,
        },
      });
      if (!data) {
        throw new BadRequestException('Đã xảy ra lỗi khi tạo luồng');
      }
      return {
        code: 200,
        message: 'tạo luồng thành công',
        status: 'success',
        data: data,
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
      const data = await this.prismaClient.flow.findMany();
      if (!data) {
        throw new BadRequestException('Danh sách luông rỗng');
      }
      return {
        code: 200,
        message: 'lấy danh sách luồng thành công',
        status: 'success',
        data: data,
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
