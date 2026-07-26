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
  findAll(): Promise<Partial<Service_Order_Detail>[]>;
  findById(id: string): Promise<Partial<Service_Order_Detail>>;
}
