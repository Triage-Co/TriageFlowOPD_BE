import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { Prisma, RoleTypeEnum, Service_Order } from '@prisma/client';
import { IServiceOrderRepository } from '../interfaces/i-service-order.repository';

@Injectable()
export class PrismaServiceOrderRepository implements IServiceOrderRepository {
  constructor(private readonly prismaService: PrismaService) {}
  delete(id: string, tx?: Prisma.TransactionClient): Promise<Service_Order> {
    const db = tx || this.prismaService;

    return db.service_Order.delete({
      where: {
        service_order_id: id,
      },
    });
  }
  create(
    data: Prisma.Service_OrderUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Service_Order> {
    const db = tx || this.prismaService;
    return db.service_Order.create({
      data: data,
    });
  }
  update(
    id: string,
    data: Prisma.Service_OrderUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Service_Order> {
    const db = tx || this.prismaService;

    return db.service_Order.update({
      where: {
        service_order_id: id,
      },
      data: data,
    });
  }

  async findAll(
    page?: number,
    limit?: number,
  ): Promise<{
    data: Partial<Service_Order>[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const parsedPage = Number(page);
    const parsedLimit = Number(limit);
    const isPaginated = parsedPage > 0 && parsedLimit > 0;

    const skip = isPaginated ? (parsedPage - 1) * parsedLimit : undefined;
    const take = isPaginated ? parsedLimit : undefined;

    const dataQuey = this.prismaService.service_Order.findMany({
      skip: skip,
      take: take,
      orderBy: {
        created_at: 'desc',
      },
    });
    const countQuery = this.prismaService.service_Order.count();

    const [data, total] = await this.prismaService.$transaction([
      dataQuey,
      countQuery,
    ]);

    return {
      data,
      meta: {
        total,
        page: isPaginated ? parsedLimit : 1,
        limit: isPaginated ? parsedLimit : total,
        totalPages: isPaginated ? Math.ceil(total / parsedLimit) : 1,
      },
    };
  }

  async findById(id: string): Promise<Partial<Service_Order> | null> {
    return await this.prismaService.service_Order.findUnique({
      where: {
        service_order_id: id,
      },
    });
  }

  async findPendingByPatientId(patientId: string): Promise<any[]> {
    const patientBookings = await this.prismaService.booking.findMany({
      where: { patient_id: patientId },
      select: { booking_id: true },
    });
    const bookingIds = patientBookings.map((b) => b.booking_id);

    return await this.prismaService.service_Order.findMany({
      where: {
        status: 'PENDING',
        OR: [
          {
            booking: {
              patient_id: patientId,
            },
          },
          {
            booking_id: {
              in: bookingIds,
            },
          },
        ],
      },
      include: {
        serviceOrderDetails: {
          include: {
            service: {
              include: {
                roomServices: {
                  include: {
                    room: true,
                  }
                }
              }
            },
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }
}
