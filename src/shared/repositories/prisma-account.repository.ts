import { Injectable } from '@nestjs/common';
import { IAccountRepository } from '../interfaces/i-account.repository';
import { PrismaService } from '../config/prisma.service';
import { Account, Prisma, RoleTypeEnum } from '@prisma/client';
import { meta } from '@turf/turf';

@Injectable()
export class PrismaAccountRepository implements IAccountRepository {
  constructor(private readonly prismaService: PrismaService) {}
  async findAllUsers(
    page?: number,
    limit?: number,
    is_active?: boolean,
    search?: string,
  ): Promise<{
    data: Partial<Account>[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const skip =
      page && limit && page > 0 && limit > 0
        ? (Number(page) - 1) * Number(limit)
        : undefined;

    const take = limit && limit > 0 ? Number(limit) : undefined;

    const whereCondition: Prisma.AccountWhereInput = {
      role: RoleTypeEnum.USER,
    };

    if (search) {
      whereCondition.OR = [
        { user_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    if (is_active !== undefined) {
      whereCondition.is_banned = !is_active;
    }

    const [dataAccount, total] = await Promise.all([
      this.prismaService.account.findMany({
        skip,
        take,
        where: whereCondition,
      }),
      this.prismaService.account.count({
        where: whereCondition,
      }),
    ]);

    return {
      data: dataAccount,
      meta: {
        total,
        page: Number(page) || 1,
        limit: take ?? total,
        totalPages: take ? Math.ceil(total / take) : 1,
      },
    };
  }
  findByPhone(phone: string): Promise<any> {
    return this.prismaService.account.findUnique({
      where: {
        phone: phone,
      },
    });
  }

  delete(id: string): Promise<any> {
    return this.prismaService.account.delete({
      where: {
        account_id: id,
      },
    });
  }

  findByEmail(email: string): Promise<any> {
    return this.prismaService.account.findUnique({
      where: {
        email: email,
      },
    });
  }

  findById(account_id: string): Promise<any> {
    return this.prismaService.account.findUnique({
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
