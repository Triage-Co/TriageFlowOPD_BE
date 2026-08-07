import {
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { IServiceRepository } from '../../shared/interfaces/i-service.repository';
import { ServiceErrors } from '../../shared/exceptions/service.exceptions';
import { PrismaService } from '../../shared/config/prisma.service';
import {
  CreateServiceReqDto,
  UpdateServiceReqDto,
  QueryServiceReqDto,
} from './dto/req-service.dto';

@Injectable()
export class ServiceService {
  constructor(
    @Inject('IServiceRepository')
    private readonly serviceRepository: IServiceRepository,
    private readonly prisma: PrismaService,
  ) {}

  private async assertCanDeactivate(serviceId: string) {
    const [activeMappings, orderDetails] = await Promise.all([
      this.prisma.room_Service.count({
        where: { service_id: serviceId, is_active: true },
      }),
      this.prisma.service_Order_Detail.count({
        where: { service_id: serviceId },
      }),
    ]);

    if (activeMappings > 0 || orderDetails > 0) {
      throw new ConflictException({
        message: 'Không thể vô hiệu hóa dịch vụ vì còn tham chiếu',
        detail: `room_services_active=${activeMappings}, service_order_details=${orderDetails}`,
      });
    }
  }

  async create(createServiceReqDto: CreateServiceReqDto) {
    const existing = await this.serviceRepository.findByServiceCode(
      createServiceReqDto.service_code,
    );
    if (existing) {
      throw ServiceErrors.ServiceExists(createServiceReqDto.service_code);
    }

    try {
      const data = await this.serviceRepository.create(createServiceReqDto);
      return {
        code: 201,
        status: 'success',
        message: 'Tạo dịch vụ mới thành công',
        data,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Lỗi không xác định';
      throw ServiceErrors.ActionFailed('Tạo dịch vụ', errorMessage);
    }
  }

  async findAll(queryReqDto: QueryServiceReqDto) {
    const page = Number(queryReqDto.page) || 1;
    const limit = Number(queryReqDto.limit) || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ServiceWhereInput = {};
    if (queryReqDto.service_type) where.service_type = queryReqDto.service_type;
    if (queryReqDto.room_type) where.room_type = queryReqDto.room_type;
    if (queryReqDto.is_active !== undefined) {
      where.is_active = queryReqDto.is_active;
    }
    if (queryReqDto.search?.trim()) {
      const q = queryReqDto.search.trim();
      where.OR = [
        { service_code: { contains: q, mode: 'insensitive' } },
        { service_name: { contains: q, mode: 'insensitive' } },
      ];
    }

    try {
      const [data, total] = await Promise.all([
        this.prisma.service.findMany({
          where,
          skip,
          take: limit,
          orderBy: { service_name: 'asc' },
        }),
        this.prisma.service.count({ where }),
      ]);

      return {
        code: 200,
        status: 'success',
        message: 'Lấy danh sách dịch vụ thành công',
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
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Lỗi không xác định';
      throw ServiceErrors.ActionFailed('Lấy danh sách dịch vụ', errorMessage);
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
      data,
    };
  }

  async update(id: string, updateServiceReqDto: UpdateServiceReqDto) {
    const existing = await this.serviceRepository.findById(id);
    if (!existing) {
      throw ServiceErrors.ServiceNotFoundById(id);
    }

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

    if (updateServiceReqDto.is_active === false) {
      await this.assertCanDeactivate(id);
    }

    try {
      const data = await this.serviceRepository.update(id, updateServiceReqDto);
      return {
        code: 200,
        status: 'success',
        message: 'Cập nhật dịch vụ thành công',
        data,
      };
    } catch (error) {
      if (error instanceof ConflictException) throw error;
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

    await this.assertCanDeactivate(id);

    try {
      const data = await this.serviceRepository.update(id, { is_active: false });
      return {
        code: 200,
        status: 'success',
        message: 'Đã vô hiệu hóa dịch vụ',
        data,
      };
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      const errorMessage =
        error instanceof Error ? error.message : 'Lỗi không xác định';
      throw ServiceErrors.ActionFailed('Vô hiệu hóa dịch vụ', errorMessage);
    }
  }
}
