import { Prisma } from '@prisma/client';

export interface IAccountRepository {
  findByEmail(email: string): Promise<any>;
  findByPhone(phone: string): Promise<any>;
  findById(account_id: string): Promise<any>;
  update(
    account_id: string,
    data: Prisma.AccountUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<any>;
  create(
    data: Prisma.AccountUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<any>;
  delete(id: string): Promise<any>;
  findAllUsers(): Promise<any>;
}
