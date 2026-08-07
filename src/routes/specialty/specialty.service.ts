import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/config/prisma.service';
import {
  CreateSpecialtyDto,
  QuerySpecialtyDto,
  UpdateSpecialtyDto,
} from './dto/create-specialty.dto';

@Injectable()
export class SpecialtyService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QuerySpecialtyDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.SpecialtyWhereInput = {};
    if (query.is_active !== undefined) {
      where.is_active = query.is_active;
    }
    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { specialty_code: { contains: q, mode: 'insensitive' } },
        { specialty_name: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.specialty.findMany({
        where,
        skip,
        take: limit,
        orderBy: { specialty_name: 'asc' },
      }),
      this.prisma.specialty.count({ where }),
    ]);

    return {
      code: 200,
      message: 'Lấy thông tin thành công',
      status: 'success',
      data: {
        data,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    };
  }

  async findOne(id: string) {
    const specialty = await this.prisma.specialty.findUnique({
      where: { specialty_id: id },
      include: {
        _count: {
          select: {
            rooms: true,
            staffs: true,
            queuePriorityRules: true,
          },
        },
      },
    });
    if (!specialty) {
      throw new NotFoundException(`Không tìm thấy chuyên khoa với ID: ${id}`);
    }
    return {
      code: 200,
      message: 'Thành công',
      status: 'success',
      data: specialty,
    };
  }

  async create(dto: CreateSpecialtyDto) {
    const existing = await this.prisma.specialty.findUnique({
      where: { specialty_code: dto.specialty_code },
    });
    if (existing) {
      throw new ConflictException({
        message: 'Mã chuyên khoa đã tồn tại',
        detail: `specialty_code=${dto.specialty_code}`,
      });
    }

    const data = await this.prisma.specialty.create({
      data: {
        specialty_code: dto.specialty_code,
        specialty_name: dto.specialty_name,
        description: dto.description,
      },
    });

    return {
      code: 201,
      message: 'Tạo chuyên khoa thành công',
      status: 'success',
      data,
    };
  }

  async update(id: string, dto: UpdateSpecialtyDto) {
    const existing = await this.prisma.specialty.findUnique({
      where: { specialty_id: id },
    });
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy chuyên khoa với ID: ${id}`);
    }

    if (dto.specialty_code && dto.specialty_code !== existing.specialty_code) {
      const duplicate = await this.prisma.specialty.findUnique({
        where: { specialty_code: dto.specialty_code },
      });
      if (duplicate) {
        throw new ConflictException({
          message: 'Mã chuyên khoa đã tồn tại',
          detail: `specialty_code=${dto.specialty_code}`,
        });
      }
    }

    const data = await this.prisma.specialty.update({
      where: { specialty_id: id },
      data: dto,
    });

    return {
      code: 200,
      message: 'Cập nhật chuyên khoa thành công',
      status: 'success',
      data,
    };
  }

  async remove(id: string) {
    const existing = await this.prisma.specialty.findUnique({
      where: { specialty_id: id },
      include: {
        _count: {
          select: {
            rooms: true,
            staffs: true,
            queuePriorityRules: true,
          },
        },
      },
    });
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy chuyên khoa với ID: ${id}`);
    }

    const { rooms, staffs, queuePriorityRules } = existing._count;
    if (rooms > 0 || staffs > 0 || queuePriorityRules > 0) {
      throw new ConflictException({
        message: 'Không thể vô hiệu hóa chuyên khoa vì còn tham chiếu',
        detail: `rooms=${rooms}, staffs=${staffs}, queue_priority_rules=${queuePriorityRules}`,
      });
    }

    const data = await this.prisma.specialty.update({
      where: { specialty_id: id },
      data: { is_active: false },
    });

    return {
      code: 200,
      message: 'Đã vô hiệu hóa chuyên khoa',
      status: 'success',
      data,
    };
  }
}
