import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { Prisma, RoleTypeEnum, Service_Order, ServiceOrderStatusEnum } from '@prisma/client';
import { IServiceOrderRepository } from '../interfaces/i-service-order.repository';

@Injectable()
export class PrismaServiceOrderRepository implements IServiceOrderRepository {
  constructor(private readonly prismaService: PrismaService) { }
  async findOrderServiceByBookingId(booking_id: string): Promise<any[]> {
    const rawOrders = await this.prismaService.service_Order.findMany({
      where: {
        booking_id: booking_id,
      },
      include: {
        staff: true,
        serviceOrderDetails: true,
        booking: {
          select: {
            slot: {
              select: {
                shift: {
                  select: {
                    room: {
                      select: {
                        room_id: true,
                        room_name: true,
                        room_type: true,
                        specialty: {
                          select: {
                            specialty_name: true,
                            specialty_id: true
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    return rawOrders.map(order => {
      const room = order.booking?.slot?.shift?.room;
      
      return {
        service_order_id: order.service_order_id,
        service_name: order.name, 
        room_id: room?.room_id || null, 
        room_name: room?.room_name || null,
        specialty_id: room?.specialty?.specialty_id || null, 
        specialty_name: room?.specialty?.specialty_name || null, 
        is_payment: order.payment_status, 
        staff_name: order.staff?.full_name || null, 
      };
    });
  }

  delete(id: string, tx?: Prisma.TransactionClient): Promise<Service_Order> {
    const db = tx || this.prismaService;

    return db.service_Order.update({
      where: {
        service_order_id: id,
      },
      data: {
        status: ServiceOrderStatusEnum.CANCELLED
      }
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
            service: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }


}
