import { Prisma, Queue } from '@prisma/client';

export interface IQueueRepository {
  create(
    data: Prisma.QueueUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Queue>;
  update(
    id: string,
    data: Prisma.QueueUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Queue>;

  findOne(id: string): Promise<Queue | null>;
  delete(id: string): Promise<Queue | null>;
  findMany(): Promise<Queue[]>;
}
