import { Prisma, Staff } from '@prisma/client';

export interface IStaffRepository {
  create(
    data: Prisma.StaffUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<any>;
  update(
    id: string,
    data: Prisma.StaffUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<any>;
  findAll(): Promise<any>;
  findById(id: string): Promise<any>;
}
