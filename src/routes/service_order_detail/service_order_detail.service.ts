import { Inject, Injectable } from '@nestjs/common';

import {
  CreateServiceOrderDetailReqDto,
  QueryServiceOrderDetailReqDto,
  UpdateServiceOrderDetailReqDto,
} from './dto/req-service_order_detail.dto';

import type { IServiceOrderDetailRepository } from '../../shared/interfaces/i-service-order-detail.repository';

import { ServiceOrderDetailErrors } from '../../shared/exceptions/service_order_detail.exceptions';

@Injectable()
export class ServiceOrderDetailService {
  constructor(
    @Inject('IServiceOrderDetailRepository')
    private readonly serviceOrderDetailRepository: IServiceOrderDetailRepository,
  ) {}

  async create(dto: CreateServiceOrderDetailReqDto) {
    try {
      const data = await this.serviceOrderDetailRepository.create(dto);

      return {
        code: 201,
        status: 'success',
        message: 'Tạo Service Order Detail thành công',
        data,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Lỗi không xác định';

      throw ServiceOrderDetailErrors.ActionFailed(
        'Tạo Service Order Detail',
        errorMessage,
      );
    }
  }

  async findAll(query: QueryServiceOrderDetailReqDto) {
    try {
      const data = await this.serviceOrderDetailRepository.findAll(
        query.page,
        query.limit,
      );

      return {
        code: 200,
        status: 'success',
        message: 'Lấy danh sách Service Order Detail thành công',
        data,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Lỗi không xác định';

      throw ServiceOrderDetailErrors.ActionFailed(
        'Lấy danh sách Service Order Detail',
        errorMessage,
      );
    }
  }

  async findOne(id: string) {
    const data = await this.serviceOrderDetailRepository.findById(id);

    if (!data) {
      throw ServiceOrderDetailErrors.ServiceOrderDetailNotFoundById(id);
    }

    return {
      code: 200,
      status: 'success',
      message: 'Lấy Service Order Detail thành công',
      data,
    };
  }

  async update(id: string, dto: UpdateServiceOrderDetailReqDto) {
    const existing = await this.serviceOrderDetailRepository.findById(id);

    if (!existing) {
      throw ServiceOrderDetailErrors.ServiceOrderDetailNotFoundById(id);
    }
    try {
      const data = await this.serviceOrderDetailRepository.update(id, dto);

      return {
        code: 200,
        status: 'success',
        message: 'Cập nhật Service Order Detail thành công',
        data,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Lỗi không xác định';

      throw ServiceOrderDetailErrors.ActionFailed(
        'Cập nhật Service Order Detail',
        errorMessage,
      );
    }
  }

  async remove(id: string) {
    const existing = await this.serviceOrderDetailRepository.findById(id);

    if (!existing) {
      throw ServiceOrderDetailErrors.ServiceOrderDetailNotFoundById(id);
    }
    try {
      await this.serviceOrderDetailRepository.delete(id);
      return {
        code: 200,
        status: 'success',
        message: 'Xóa Service Order Detail thành công',
        data: null,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Lỗi không xác định';

      throw ServiceOrderDetailErrors.ActionFailed(
        'Xóa Service Order Detail',
        errorMessage,
      );
    }
  }
}
