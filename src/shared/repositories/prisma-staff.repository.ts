import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { IStaffRepository } from '../interfaces/i-staff.repository';
import { Prisma, RoleTypeEnum } from '@prisma/client';

@Injectable()
export class PrismaStaffRepository implements IStaffRepository {
  constructor(private readonly prismaService: PrismaService) {}

  update(id: string, data: any, tx?: Prisma.TransactionClient): Promise<any> {
    const db = tx || this.prismaService;

    return db.staff.update({
      where: {
        staff_id: id,
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

  findAll(): Promise<any> {
    return this.prismaService.staff.findMany({
      include: {
        account: {
          omit: {
            account_id: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      omit: {
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  findById(id: string): Promise<any> {
    return this.prismaService.staff.findFirst({
      where: {
        staff_id: id,
      },
      include: {
        account: {
          omit: {
            account_id: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      omit: {
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  delete(id: string): Promise<any> {
    return this.prismaService.staff.delete({
      where: {
        staff_id: id,
      },
    });
  }

  create(data: any): Promise<any> {
    return this.prismaService.staff.create({
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
