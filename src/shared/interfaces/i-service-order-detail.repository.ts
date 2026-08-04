import { Prisma, Service_Order_Detail, Staff } from '@prisma/client';

export interface IServiceOrderDetailRepository {
  create(
    data: Prisma.Service_Order_DetailUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Service_Order_Detail>;
  update(
    id: string,
    data: Prisma.Service_Order_DetailUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Service_Order_Detail>;
  findAll(
    page?: number,
    limit?: number,
  ): Promise<{
    data: Partial<Service_Order_Detail>[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }>;
  findById(id: string): Promise<Partial<Service_Order_Detail> | null>;
  findByServiceOrderId(
    serviceOrderId: string,
  ): Promise<Service_Order_Detail | null>;
  delete(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Service_Order_Detail>;
}
