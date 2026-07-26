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
  findAll(): Promise<Partial<Service_Order>[]>;
  findById(id: string): Promise<Partial<Service_Order>>;
}
