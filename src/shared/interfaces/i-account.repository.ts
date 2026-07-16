import { Prisma } from '@prisma/client';

export interface IAccountRepository {
  findByEmail(email: string): Promise<any>;
  findById(account_id: string): Promise<any>;
  update(
    account_id: string,
    data: any,
    tx?: Prisma.TransactionClient,
  ): Promise<any>;
  create(data: any): Promise<any>;
  delete(id: string): Promise<any>;
  findAll(): Promise<any>;
}
