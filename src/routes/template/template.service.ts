import { Inject, Injectable } from '@nestjs/common';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import type { ITemplateRepository } from '../../shared/interfaces/i-template.repository';

@Injectable()
export class TemplateService {
  constructor(
    @Inject('ITemplateRepository')
    private readonly templateRepository: ITemplateRepository,
  ) {}

  async create(createTemplateDto: CreateTemplateDto) {
    const data = await this.templateRepository.create({
      name: createTemplateDto.name,
      steps: createTemplateDto.steps as any,
    });
    return {
      code: 200,
      status: 'success',
      message: 'Tạo template thành công',
      data: data,
    };
  }

  async findAll() {
    const data = await this.templateRepository.findAll();
    return {
      code: 200,
      status: 'success',
      message: 'Lấy danh sách template thành công',
      data: data,
    };
  }

  async findOne(id: string) {
    const data = await this.templateRepository.findById(id);
    return {
      code: 200,
      status: 'success',
      message: 'Lấy thông tin template thành công',
      data: data,
    };
  }

  async findByName(name: string) {
    const data = await this.templateRepository.findByName(name);
    return {
      code: 200,
      status: 'success',
      message: 'Lấy thông tin template theo tên thành công',
      data: data,
    };
  }

  async update(id: string, updateTemplateDto: UpdateTemplateDto) {
    const data = await this.templateRepository.update(id, {
      name: updateTemplateDto.name,
      steps: updateTemplateDto.steps as any,
    });
    return {
      code: 200,
      status: 'success',
      message: 'Cập nhật template thành công',
      data: data,
    };
  }

  async remove(id: string) {
    const data = await this.templateRepository.delete(id);
    return {
      code: 200,
      status: 'success',
      message: 'Xóa template thành công',
      data: data,
    };
  }
}
