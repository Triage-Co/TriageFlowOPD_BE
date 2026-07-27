import { Inject, Injectable } from '@nestjs/common';
import {
  CreateServiceReqDto,
  UpdateServiceReqDto,
  QueryServiceReqDto,
} from './dto/req-service.dto';
import type { IServiceRepository } from '../../shared/interfaces/i-service.repository';
import { ServiceErrors } from '../../shared/exceptions/service.exceptions';

@Injectable()
export class ServiceService {
  constructor(
    @Inject('IServiceRepository')
    private readonly serviceRepository: IServiceRepository,
  ) {}

  async create(createServiceReqDto: CreateServiceReqDto) {
    if (createServiceReqDto.service_code) {
      const existing = await this.serviceRepository.findByServiceCode(
        createServiceReqDto.service_code,
      );
      if (existing) {
        throw ServiceErrors.ServiceExists(createServiceReqDto.service_code);
      }
    }

    try {
      const data = await this.serviceRepository.create(
        createServiceReqDto as any,
      );

      return {
        code: 201,
        status: 'success',
        message: 'Tạo dịch vụ mới thành công',
        data: data,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Lỗi không xác định';
      throw ServiceErrors.ActionFailed('Cập nhật dịch vụ', errorMessage);
    }
  }

  async findAll(queryReqDto: QueryServiceReqDto) {
    const { page, limit } = queryReqDto;

    try {
      const data = await this.serviceRepository.findAll(page, limit);

      return {
        code: 200,
        status: 'success',
        message: 'Lấy danh sách dịch vụ thành công',
        data: data,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Lỗi không xác định';
      throw ServiceErrors.ActionFailed('Cập nhật dịch vụ', errorMessage);
    }
  }

  async findOne(id: string) {
    const data = await this.serviceRepository.findById(id);

    if (!data) {
      throw ServiceErrors.ServiceNotFoundById(id);
    }

    return {
      code: 200,
      status: 'success',
      message: `Lấy thông tin dịch vụ thành công`,
      data: data,
    };
  }

  async update(id: string, updateServiceReqDto: UpdateServiceReqDto) {
    const existing = await this.serviceRepository.findById(id);

    if (!existing) {
      throw ServiceErrors.ServiceNotFoundById(id);
    }

    // Nếu có update service_code, phải check xem có trùng với code của một dịch vụ khác không
    if (
      updateServiceReqDto.service_code &&
      updateServiceReqDto.service_code !== existing.service_code
    ) {
      const duplicateCode = await this.serviceRepository.findByServiceCode(
        updateServiceReqDto.service_code,
      );
      if (duplicateCode) {
        throw ServiceErrors.ServiceExists(updateServiceReqDto.service_code);
      }
    }

    try {
      const data = await this.serviceRepository.update(
        id,
        updateServiceReqDto as any,
      );

      return {
        code: 200,
        status: 'success',
        message: 'Cập nhật dịch vụ thành công',
        data: data,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Lỗi không xác định';
      throw ServiceErrors.ActionFailed('Cập nhật dịch vụ', errorMessage);
    }
  }

  async remove(id: string) {
    const existing = await this.serviceRepository.findById(id);

    if (!existing) {
      throw ServiceErrors.ServiceNotFoundById(id);
    }

    try {
      // Lưu ý: hãy đảm bảo interface IServiceRepository của bạn đã khai báo hàm delete
      await this.serviceRepository.delete(id);

      return {
        code: 200,
        status: 'success',
        message: 'Xóa dịch vụ thành công',
        data: null,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Lỗi không xác định';
      throw ServiceErrors.ActionFailed('Cập nhật dịch vụ', errorMessage);
    }
  }
}
