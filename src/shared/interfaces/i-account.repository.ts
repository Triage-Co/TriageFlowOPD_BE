import { Account, Prisma } from '@prisma/client';

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
  findAllUsers(
    page?: number,
    limit?: number,
    is_active?: boolean,
    search?: string,
  ): Promise<{
    data: Partial<Account>[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }>;
  findEmailByCitizentId(citizen_id: string): Promise<{ email: string } | null>;
}
