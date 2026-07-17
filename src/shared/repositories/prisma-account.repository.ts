import { Injectable } from '@nestjs/common';
import { IAccountRepository } from '../interfaces/i-account.repository';
import { PrismaService } from '../config/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrismaAccountRepository implements IAccountRepository {
  constructor(private readonly prismaService: PrismaService) {}
  findAll(): Promise<any> {
    return this.prismaService.account.findMany();
  }

  delete(id: string): Promise<any> {
    return this.prismaService.account.delete({
      where: {
        account_id: id,
      },
    });
  }

  findByEmail(email: string): Promise<any> {
    return this.prismaService.account.findFirst({
      where: {
        email: email,
      },
    });
  }

  findById(account_id: string): Promise<any> {
    return this.prismaService.account.findFirst({
      where: {
        account_id: account_id,
      },
    });
  }
  update(
    account_id: string,
    data: Prisma.AccountUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<any> {
    const db = tx || this.prismaService;
    return db.account.update({
      where: {
        account_id: account_id,
      },
      data: {
        ...data,
      },
      omit: {
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  create(
    data: Prisma.AccountUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<any> {
    const db = tx || this.prismaService;
    return db.account.create({
      data: {
        ...data,
      },
      omit: {
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
