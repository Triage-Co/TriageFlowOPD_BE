import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/config/prisma.service';
import {
  BulkCreateMedicineDto,
  CreateMedicineDto,
} from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';

@Injectable()
export class MedicineService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(createMedicineDto: CreateMedicineDto) {
    const existing = await this.prismaService.medicine.findUnique({
      where: { medicine_code: createMedicineDto.medicine_code },
    });

    if (existing) {
      throw new ConflictException(
        `Mã thuốc '${createMedicineDto.medicine_code}' đã tồn tại.`,
      );
    }

    return this.prismaService.medicine.create({
      data: createMedicineDto,
    });
  }

  async bulkCreate(bulkDto: BulkCreateMedicineDto) {
    const { medicines } = bulkDto;
    if (!medicines || medicines.length === 0) {
      return { message: 'Danh sách thuốc trống.', count: 0, data: [] };
    }

    return this.prismaService.$transaction(async (tx) => {
      const results: any[] = [];
      for (const item of medicines) {
        const upserted = await tx.medicine.upsert({
          where: { medicine_code: item.medicine_code },
          update: item,
          create: item,
        });
        results.push(upserted);
      }
      return {
        message: `Đã khởi tạo thành công ${results.length} loại thuốc.`,
        count: results.length,
        data: results,
      };
    });
  }

  async findAll(query: {
    search?: string;
    is_active?: boolean;
    usage_route?: string;
    manufacturer?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.is_active !== undefined) {
      where.is_active =
        String(query.is_active) === 'true' || query.is_active === true;
    }

    if (query.search) {
      where.OR = [
        { medicine_name: { contains: query.search, mode: 'insensitive' } },
        { medicine_code: { contains: query.search, mode: 'insensitive' } },
        { active_ingredient: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.usage_route) {
      where.usage_route = {
        equals: query.usage_route,
        mode: 'insensitive',
      };
    }

    if (query.manufacturer) {
      where.manufacturer = {
        contains: query.manufacturer,
        mode: 'insensitive',
      };
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

  async getRoutes() {
    const medicines = await this.prismaService.medicine.findMany({
      where: { usage_route: { not: null }, is_active: true },
      select: { usage_route: true },
      distinct: ['usage_route'],
    });

    const routes = medicines.map((m) => m.usage_route).filter(Boolean);
    return { data: routes };
  }

  async getActiveIngredients() {
    const medicines = await this.prismaService.medicine.findMany({
      where: { active_ingredient: { not: null }, is_active: true },
      select: { active_ingredient: true },
      distinct: ['active_ingredient'],
    });

    const ingredients = medicines
      .map((m) => m.active_ingredient)
      .filter(Boolean);
    return { data: ingredients };
  }

  async getManufacturers() {
    const medicines = await this.prismaService.medicine.findMany({
      where: { manufacturer: { not: null }, is_active: true },
      select: { manufacturer: true },
      distinct: ['manufacturer'],
    });

    const manufacturers = medicines.map((m) => m.manufacturer).filter(Boolean);
    return { data: manufacturers };
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
        throw new ConflictException(
          `Mã thuốc '${updateMedicineDto.medicine_code}' đã bị sử dụng.`,
        );
      }
    }

    if (updateMedicineDto.is_active === false) {
      await this.assertNoPrescriptionDetailRefs(id);
    }

    return this.prismaService.medicine.update({
      where: { medicine_id: id },
      data: updateMedicineDto,
    });
  }

  async restore(id: string) {
    await this.findOne(id);
    return this.prismaService.medicine.update({
      where: { medicine_id: id },
      data: { is_active: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.assertNoPrescriptionDetailRefs(id);
    return this.prismaService.medicine.update({
      where: { medicine_id: id },
      data: { is_active: false },
    });
  }

  private async assertNoPrescriptionDetailRefs(id: string) {
    const activePrescriptionsCount =
      await this.prismaService.prescription_Detail.count({
        where: {
          medicine_id: id,
          prescription: {
            status: {
              in: ['PENDING', 'PROCESSING', 'PREPARED'],
            },
          },
        },
      });

    if (activePrescriptionsCount > 0) {
      throw new ConflictException({
        message:
          'Không thể vô hiệu hóa thuốc vì vẫn còn nằm trong đơn thuốc chưa được giao',
        detail: `activePrescriptions=${activePrescriptionsCount}`,
      });
    }
  }
}
