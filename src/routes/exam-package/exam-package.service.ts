import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateExamPackageDto } from './dto/create-exam-package.dto';
import { UpdateExamPackageDto } from './dto/update-exam-package.dto';
import { PrismaService } from '../../shared/config/prisma.service';

const TEMPLATE_SELECT = { template_id: true, template_name: true } as const;

@Injectable()
export class ExamPackageService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createExamPackageDto: CreateExamPackageDto) {
    const template = await this.prisma.flow_Template.findUnique({
      where: { template_id: createExamPackageDto.template_id },
    });
    if (!template) {
      throw new NotFoundException({
        message: 'Không tìm thấy template luồng khám',
        detail: `Không tìm thấy template với ID: ${createExamPackageDto.template_id}`,
      });
    }

    const newPackage = await this.prisma.exam_Package.create({
      data: createExamPackageDto,
      include: { template: { select: TEMPLATE_SELECT } },
    });
    return {
      code: 201,
      message: 'Tạo gói khám thành công',
      status: 'success',
      data: newPackage,
    };
  }

  async findAll(query?: { is_active?: boolean }) {
    const where: Prisma.Exam_PackageWhereInput = {};
    if (query?.is_active !== undefined) {
      where.is_active = query.is_active;
    }

    const packages = await this.prisma.exam_Package.findMany({
      where,
      include: { template: { select: TEMPLATE_SELECT } },
      orderBy: { created_at: 'desc' },
    });
    return {
      code: 200,
      message: 'Thành công',
      status: 'success',
      data: packages,
    };
  }

  async findOne(id: string) {
    const examPackage = await this.prisma.exam_Package.findUnique({
      where: { package_id: id },
      include: { template: { select: TEMPLATE_SELECT } },
    });
    if (!examPackage)
      throw new NotFoundException(`Không tìm thấy gói khám với ID ${id}`);
    return {
      code: 200,
      message: 'Thành công',
      status: 'success',
      data: examPackage,
    };
  }

  private async assertNoServiceOrderRefs(id: string) {
    const count = await this.prisma.service_Order.count({
      where: { package_id: id },
    });
    if (count > 0) {
      throw new ConflictException({
        message: 'Không thể vô hiệu hóa gói khám vì còn tham chiếu đơn khám',
        detail: `serviceOrders=${count}`,
      });
    }
  }

  async update(id: string, updateExamPackageDto: UpdateExamPackageDto) {
    const examPackage = await this.prisma.exam_Package.findUnique({
      where: { package_id: id },
    });
    if (!examPackage)
      throw new NotFoundException(`Không tìm thấy gói khám với ID ${id}`);

    if (
      updateExamPackageDto.template_id &&
      updateExamPackageDto.template_id !== examPackage.template_id
    ) {
      const template = await this.prisma.flow_Template.findUnique({
        where: { template_id: updateExamPackageDto.template_id },
      });
      if (!template) {
        throw new NotFoundException({
          message: 'Không tìm thấy template luồng khám',
          detail: `Không tìm thấy template với ID: ${updateExamPackageDto.template_id}`,
        });
      }
    }

    if (updateExamPackageDto.is_active === false) {
      await this.assertNoServiceOrderRefs(id);
    }

    const updated = await this.prisma.exam_Package.update({
      where: { package_id: id },
      data: updateExamPackageDto,
      include: { template: { select: TEMPLATE_SELECT } },
    });
    return {
      code: 200,
      message: 'Cập nhật thành công',
      status: 'success',
      data: updated,
    };
  }

  async remove(id: string) {
    const examPackage = await this.prisma.exam_Package.findUnique({
      where: { package_id: id },
    });
    if (!examPackage)
      throw new NotFoundException(`Không tìm thấy gói khám với ID ${id}`);

    await this.assertNoServiceOrderRefs(id);

    const updated = await this.prisma.exam_Package.update({
      where: { package_id: id },
      data: { is_active: false },
    });
    return {
      code: 200,
      message: 'Đã vô hiệu hóa gói khám thành công',
      status: 'success',
      data: updated,
    };
  }
}
