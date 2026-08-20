import { Prisma, Service_Order, Staff } from '@prisma/client';

export interface IServiceOrderRepository {
  create(
    data: Prisma.Service_OrderUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Service_Order>;
  update(
    id: string,
    data: Prisma.Service_OrderUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Service_Order>;
  findAll(
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
  }>;
  findById(id: string): Promise<any | null>;
  delete(id: string, tx?: Prisma.TransactionClient): Promise<Service_Order>;
  findPendingByPatientId(patientId: string): Promise<any[]>;
  findOrderServiceByBookingId(booking_id: string): Promise<any[]>;
}
