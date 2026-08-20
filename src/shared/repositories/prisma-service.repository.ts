import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { IStaffRepository } from '../interfaces/i-staff.repository';
import { Prisma, RoleTypeEnum, Service, ServiceTypeEnum } from '@prisma/client';
import { IServiceOrderRepository } from '../interfaces/i-service-order.repository';
import { IServiceRepository } from '../interfaces/i-service.repository';

@Injectable()
export class PrismaServiceRepository implements IServiceRepository {
  constructor(private readonly prismaService: PrismaService) {}
  findManyByCode(codes: string[]): Promise<Service[]> {
    return this.prismaService.service.findMany({
      where: {
        service_code: {
          in: codes,
        },
      },
    });
  }
  findByCode(code: string): Promise<Service | null> {
    return this.prismaService.service.findFirst({
      where: {
        service_code: code,
      },
    });
  }
  delete(id: string, tx?: Prisma.TransactionClient): Promise<Service> {
    const db = tx || this.prismaService;

    return db.service.delete({
      where: {
        service_id: id,
      },
    });
  }

  create(
    data: Prisma.ServiceUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Service> {
    const db = tx || this.prismaService;
    return db.service.create({
      data: data,
    });
  }
  update(
    id: string,
    data: Prisma.ServiceUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Service> {
    const db = tx || this.prismaService;
    return db.service.update({
      data: data,
      where: {
        service_id: id,
      },
    });
  }
  async findAll(
    page?: number,
    limit?: number,
    service_type?: ServiceTypeEnum,
    search?: string,
    is_active?: boolean | string,
  ): Promise<
    Partial<{
      data: Partial<Service>[];
      meta: { total: number; page: number; limit: number; totalPages: number };
    }>
  > {
    const parsedPage = Number(page);
    const parsedLimit = Number(limit);

    const isPanigation = parsedPage > 0 && parsedLimit > 0 ? true : false;

    const where: Prisma.ServiceWhereInput = service_type
      ? { service_type }
      : {};

    if (search) {
      where.OR = [
        { service_name: { contains: search, mode: 'insensitive' } },
        { service_code: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (is_active !== undefined) {
      where.is_active = is_active === 'true' || is_active === true;
    }

    const findOptions: Prisma.ServiceFindManyArgs = {
      where,
    };

    if (isPanigation) {
      findOptions.skip = (parsedPage - 1) * parsedLimit;
      findOptions.take = parsedLimit;
    }

    const dataQuery = this.prismaService.service.findMany(findOptions);
    const countQuery = this.prismaService.service.count({ where });
    const [data, total] = await this.prismaService.$transaction([
      dataQuery,
      countQuery,
    ]);
    return {
      data,
      meta: {
        total,
        page: isPanigation ? parsedPage : 1,
        limit: isPanigation ? parsedLimit : total,
        totalPages: isPanigation ? Math.ceil(total / parsedLimit) : 1,
      },
    };
  }
  findById(id: string): Promise<Partial<Service> | null> {
    return this.prismaService.service.findFirst({
      where: {
        service_id: id,
      },
    });
  }

  findByServiceCode(code: string): Promise<Partial<Service> | null> {
    return this.prismaService.service.findFirst({
      where: {
        service_code: code,
      },
    });
  }
}
