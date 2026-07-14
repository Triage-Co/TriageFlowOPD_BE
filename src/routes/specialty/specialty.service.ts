import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/config/prisma.service';

@Injectable()
export class SpecialtyService {
  constructor(private readonly prismaService: PrismaService) {}

  async findAll() {
    const data = await this.prismaService.specialty.findMany({
      omit: {
        createdAt: true,
        updatedAt: true,
      },
    });
    return {
      code: 200,
      message: 'Lấy thông tin thành công',
      status: 'success',
      data: data,
    };
  }
}
