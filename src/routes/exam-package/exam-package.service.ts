import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateExamPackageDto } from './dto/create-exam-package.dto';
import { UpdateExamPackageDto } from './dto/update-exam-package.dto';
import { PrismaService } from '../../shared/config/prisma.service';

@Injectable()
export class ExamPackageService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createExamPackageDto: CreateExamPackageDto) {
    const newPackage = await this.prisma.exam_Package.create({
      data: createExamPackageDto,
    });
    return {
      code: 201,
      message: 'Tạo gói khám thành công',
      status: 'success',
      data: newPackage,
    };
  }

  async findAll() {
    const packages = await this.prisma.exam_Package.findMany({
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
      include: { template: true },
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

  async update(id: string, updateExamPackageDto: UpdateExamPackageDto) {
    const examPackage = await this.prisma.exam_Package.findUnique({
      where: { package_id: id },
    });
    if (!examPackage)
      throw new NotFoundException(`Không tìm thấy gói khám với ID ${id}`);

    const updated = await this.prisma.exam_Package.update({
      where: { package_id: id },
      data: updateExamPackageDto,
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

    await this.prisma.exam_Package.delete({
      where: { package_id: id },
    });
    return {
      code: 200,
      message: 'Xóa thành công',
      status: 'success',
    };
  }
}
