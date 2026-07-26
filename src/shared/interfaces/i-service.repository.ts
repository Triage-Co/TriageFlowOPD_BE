import { Prisma, Service, Staff } from '@prisma/client';

export interface IServiceRepository {
  create(
    data: Prisma.ServiceUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Service>;
  update(
    id: string,
    data: Prisma.ServiceUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Service>;
  findAll(): Promise<Partial<Service>[]>;
  findById(id: string): Promise<Partial<Service>>;
}
