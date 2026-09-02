import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import {
  PaymentStatusEnum,
  Prisma,
  Service_Order,
  ServiceOrderStatusEnum,
} from '@prisma/client';
import {
  BookingBillingContext,
  IServiceOrderRepository,
  PatientBillingFilters,
} from '../interfaces/i-service-order.repository';

const BILLING_ORDER_INCLUDE = {
  invoices: {
    include: {
      invoice_details: true,
    },
    orderBy: {
      created_at: 'desc' as const,
    },
  },
  transactions: {
    orderBy: {
      transDate: 'desc' as const,
    },
  },
  serviceOrderDetails: {
    include: {
      service: {
        select: {
          service_code: true,
          service_name: true,
        },
      },
    },
  },
  prescription: {
    select: {
      prescription_id: true,
      total_amount: true,
      status: true,
    },
  },
  booking: {
    select: {
      booking_id: true,
      patient_id: true,
      created_at: true,
      visitSession: {
        select: {
          visit_session_id: true,
          visit_date: true,
        },
      },
      flow: {
        select: {
          flow_id: true,
          ticket_code: true,
        },
      },
    },
  },
} satisfies Prisma.Service_OrderInclude;

@Injectable()
export class PrismaServiceOrderRepository implements IServiceOrderRepository {
  constructor(private readonly prismaService: PrismaService) {}
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
                            specialty_id: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return rawOrders.map((order) => {
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
        status: ServiceOrderStatusEnum.CANCELLED,
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

  async findById(id: string): Promise<any> {
    const rawData = await this.prismaService.service_Order.findUnique({
      where: {
        service_order_id: id,
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
                            specialty_id: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!rawData) return null;

    const room = rawData.booking?.slot?.shift?.room;

    return {
      ...rawData,
      status: rawData.status,
      service_name: rawData.name,
      room_id: room?.room_id || null,
      room_name: room?.room_name || null,
      specialty_id: room?.specialty?.specialty_id || null,
      specialty_name: room?.specialty?.specialty_name || null,
      is_payment: rawData.payment_status,
      staff_name: rawData.staff?.full_name || null,
    };
  }

  async findPendingByPatientId(patientId: string): Promise<any[]> {
    const patientBookings = await this.prismaService.booking.findMany({
      where: { patient_id: patientId },
      select: { booking_id: true },
    });

    const bookingIds = patientBookings.map((b) => b.booking_id);

    return await this.prismaService.service_Order.findMany({
      where: {
        payment_status: PaymentStatusEnum.PENDING,
        status: {
          notIn: [
            ServiceOrderStatusEnum.CANCELLED,
            ServiceOrderStatusEnum.PAID,
            ServiceOrderStatusEnum.COMPLETED,
          ],
        },
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
        prescription: {
          include: {
            prescriptionDetails: {
              include: {
                medicine: true,
              },
            },
          },
        },
        invoices: {
          include: {
            invoice_details: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async findBillingByPatientId(
    patientId: string,
    filters?: PatientBillingFilters,
  ): Promise<any[]> {
    const dateRange = this.toDateRange(filters?.from, filters?.to);

    const bookingFilter: Prisma.BookingWhereInput = {
      patient_id: patientId,
      ...(dateRange
        ? {
            OR: [
              { visitSession: { visit_date: dateRange } },
              {
                AND: [
                  { visitSession: { is: null } },
                  { created_at: dateRange },
                ],
              },
            ],
          }
        : {}),
    };

    return this.prismaService.service_Order.findMany({
      where: {
        status: {
          not: ServiceOrderStatusEnum.CANCELLED,
        },
        ...(filters?.paymentStatus
          ? { payment_status: filters.paymentStatus }
          : {}),
        booking: bookingFilter,
      },
      include: BILLING_ORDER_INCLUDE,
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async findBillingByBookingId(
    bookingId: string,
  ): Promise<BookingBillingContext> {
    const booking = await this.prismaService.booking.findUnique({
      where: { booking_id: bookingId },
      select: {
        booking_id: true,
        patient_id: true,
        created_at: true,
        visitSession: {
          select: {
            visit_session_id: true,
            visit_date: true,
          },
        },
        flow: {
          select: {
            flow_id: true,
            ticket_code: true,
          },
        },
      },
    });

    if (!booking) {
      return { booking: null, orders: [] };
    }

    const orders = await this.prismaService.service_Order.findMany({
      where: {
        booking_id: bookingId,
        status: {
          not: ServiceOrderStatusEnum.CANCELLED,
        },
      },
      include: BILLING_ORDER_INCLUDE,
      orderBy: {
        created_at: 'desc',
      },
    });

    return { booking, orders };
  }

  private toDateRange(
    from?: Date,
    to?: Date,
  ): Prisma.DateTimeFilter | undefined {
    if (!from && !to) {
      return undefined;
    }

    return {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }
}
