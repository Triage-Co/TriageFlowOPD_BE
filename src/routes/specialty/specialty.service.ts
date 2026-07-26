import { Inject, Injectable } from '@nestjs/common';
import type { ISpecialtyRepository } from '../../shared/interfaces/i-specialty.repository';

@Injectable()
export class SpecialtyService {
  constructor(
    @Inject('ISpecialtyRepository')
    private readonly specialtyRepository: ISpecialtyRepository,
  ) {}

  async findAll(page?: number, limit?: number) {
    const data = await this.specialtyRepository.findAll(page, limit);
    return {
      code: 200,
      message: 'Lấy thông tin thành công',
      status: 'success',
      data: data,
    };
  }
}
