import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { IStaffRepository } from '../interfaces/i-staff.repository';
import { Prisma, RoleTypeEnum, Service_Order_Detail } from '@prisma/client';
import { IServiceOrderDetailRepository } from '../interfaces/i-service-order-detail.repository';

@Injectable()
export class PrismaServiceOrderDetailRepository implements IServiceOrderDetailRepository {
  constructor(private readonly prismaService: PrismaService) {}
  delete(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Service_Order_Detail> {
    const db = tx || this.prismaService;

    return db.service_Order_Detail.delete({
      where: {
        service_order_detail_id: id,
      },
    });
  }
  create(
    data: Prisma.Service_Order_DetailUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Service_Order_Detail> {
    const db = tx || this.prismaService;
    return db.service_Order_Detail.create({
      data: data,
    });
  }
  update(
    id: string,
    data: Prisma.Service_Order_DetailUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Service_Order_Detail> {
    const db = tx || this.prismaService;
    return db.service_Order_Detail.update({
      where: {
        service_order_detail_id: id,
      },
      data: data,
    });
  }

  async findAll(
    page?: number,
    limit?: number,
  ): Promise<{
    data: Partial<Service_Order_Detail>[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const parsedPage = Number(page);
    const parsedLimit = Number(limit);
    const isPaginated = parsedPage > 0 && parsedLimit > 0;

    const skip = isPaginated ? (parsedPage - 1) * parsedLimit : undefined;
    const take = isPaginated ? parsedLimit : undefined;

    const dataQuery = this.prismaService.service_Order_Detail.findMany({
      skip: skip,
      take: take,
      orderBy: {
        created_at: 'desc',
      },
    });
    const countQuery = this.prismaService.service_Order_Detail.count();
    const [data, total] = await this.prismaService.$transaction([
      dataQuery,
      countQuery,
    ]);
    return {
      data,
      meta: {
        total,
        limit: isPaginated ? parsedLimit : total,
        page: isPaginated ? parsedPage : 1,
        totalPages: isPaginated ? Math.ceil(total / parsedLimit) : 1,
      },
    };
  }

  findById(id: string): Promise<Partial<Service_Order_Detail> | null> {
    return this.prismaService.service_Order_Detail.findUnique({
      where: {
        service_order_detail_id: id,
      },
    });
  }

  findByServiceOrderId(serviceOrderId: string): Promise<Service_Order_Detail | null> {
    return this.prismaService.service_Order_Detail.findFirst({
      where: {
        service_order_id: serviceOrderId,
      },
    });
  }
}
