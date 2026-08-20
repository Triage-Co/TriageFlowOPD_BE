import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { ITemplateRepository } from '../interfaces/i-template.repository';

@Injectable()
export class PrismaTemplateRepository implements ITemplateRepository {
  constructor(private readonly prismaService: PrismaService) {}
  create(data: any): Promise<any> {
    return this.prismaService.flow_Template.create({
      data: {
        template_name: data.name,
        steps: data.steps,
      },
    });
  }
  async update(id: string, data: any): Promise<any> {
    await this.findById(id);
    return this.prismaService.flow_Template.update({
      where: { template_id: id },
      data: {
        template_name: data.name,
        steps: data.steps,
      },
    });
  }
  findAll(): Promise<any> {
    return this.prismaService.flow_Template.findMany();
  }
  async findById(id: string): Promise<any> {
    const template = await this.prismaService.flow_Template.findUnique({
      where: { template_id: id },
    });
    if (!template)
      throw new NotFoundException({
        message: 'Template không tồn tại',
        detail: 'Template không tồn tại',
      });
    return template;
  }
  async findByName(templateName: string): Promise<any> {
    const template = await this.prismaService.flow_Template.findFirst({
      where: { template_name: templateName },
    });
    if (!template)
      throw new NotFoundException({
        message: 'Template không tồn tại',
        detail: 'Template không tồn tại',
      });
    return template;
  }
  async delete(id: string): Promise<any> {
    await this.findById(id);

    const count = await this.prismaService.exam_Package.count({
      where: { template_id: id },
    });
    if (count > 0) {
      throw new ConflictException({
        message: 'Quy trình Khám đã được sử dụng trong gói khám, không thể xóa',
        detail: `examPackages=${count}`,
      });
    }

    return this.prismaService.flow_Template.delete({
      where: { template_id: id },
    });
  }
}
