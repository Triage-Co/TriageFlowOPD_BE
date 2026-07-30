import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/config/prisma.service';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';

@Injectable()
export class MedicineService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(createMedicineDto: CreateMedicineDto) {
    const existing = await this.prismaService.medicine.findUnique({
      where: { medicine_code: createMedicineDto.medicine_code },
    });

    if (existing) {
      throw new ConflictException(`Mã thuốc '${createMedicineDto.medicine_code}' đã tồn tại.`);
    }

    return this.prismaService.medicine.create({
      data: createMedicineDto,
    });
  }

  async findAll(query: { search?: string; is_active?: boolean; page?: number; limit?: number }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.is_active !== undefined) {
      where.is_active = String(query.is_active) === 'true' || query.is_active === true;
    }

    if (query.search) {
      where.OR = [
        { medicine_name: { contains: query.search, mode: 'insensitive' } },
        { medicine_code: { contains: query.search, mode: 'insensitive' } },
        { active_ingredient: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prismaService.medicine.findMany({
        where,
        skip,
        take: limit,
        orderBy: { medicine_name: 'asc' },
      }),
      this.prismaService.medicine.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const medicine = await this.prismaService.medicine.findUnique({
      where: { medicine_id: id },
    });

    if (!medicine) {
      throw new NotFoundException(`Không tìm thấy thuốc với ID: ${id}`);
    }

    return medicine;
  }

  async update(id: string, updateMedicineDto: UpdateMedicineDto) {
    await this.findOne(id);

    if (updateMedicineDto.medicine_code) {
      const existing = await this.prismaService.medicine.findFirst({
        where: {
          medicine_code: updateMedicineDto.medicine_code,
          NOT: { medicine_id: id },
        },
      });

      if (existing) {
        throw new ConflictException(`Mã thuốc '${updateMedicineDto.medicine_code}' đã bị sử dụng.`);
      }
    }

    return this.prismaService.medicine.update({
      where: { medicine_id: id },
      data: updateMedicineDto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prismaService.medicine.update({
      where: { medicine_id: id },
      data: { is_active: false },
    });
  }
}
