import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { IStaffRepository } from '../interfaces/i-staff.repository';
import { Prisma, RoleTypeEnum, Service } from '@prisma/client';
import { IServiceOrderRepository } from '../interfaces/i-service-order.repository';
import { IServiceRepository } from '../interfaces/i-service.repository';

@Injectable()
export class PrismaServiceRepository implements IServiceRepository {
  constructor(private readonly prismaService: PrismaService) {}
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
  ): Promise<
    Partial<{
      data: Partial<Service>[];
      meta: { total: number; page: number; limit: number; totalPages: number };
    }>
  > {
    const parsedPage = Number(page);
    const parsedLimit = Number(limit);
    const isPanigation = parsedPage > 0 && parsedLimit > 0 ? true : false;
    const take = isPanigation ? parsedLimit : 1;
    const skip = isPanigation ? (parsedPage - 1) * parsedLimit : 1;

    const dataQuery = this.prismaService.service.findMany({
      skip: skip,
      take: take,
    });
    const countQuery = this.prismaService.service.count();
    const [data, total] = await this.prismaService.$transaction([
      dataQuery,
      countQuery,
    ]);
    return {
      data,
      meta: {
        total,
        page: isPanigation ? parsedPage : 1,
        limit: isPanigation ? parsedLimit : 1,
        totalPages: isPanigation ? total / parsedLimit : 1,
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
