import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { IStaffRepository } from '../interfaces/i-staff.repository';
import { Prisma, RoleTypeEnum } from '@prisma/client';

@Injectable()
export class PrismaStaffRepository implements IStaffRepository {
  constructor(private readonly prismaService: PrismaService) {}

  create(
    data: Prisma.StaffUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<any> {
    const db = tx || this.prismaService;

    return db.staff.create({
      data: {
        ...data,
      },
    });
  }

  update(
    id: string,
    data: Prisma.StaffUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<any> {
    const db = tx || this.prismaService;

    return db.staff.update({
      where: {
        staff_id: id,
      },
      data: {
        ...data,
      },
    });
  }

  findAll(): Promise<any> {
    return this.prismaService.staff.findMany({
      include: {
        account: true,
      },
    });
  }

  findById(id: string): Promise<any> {
    return this.prismaService.staff.findFirst({
      where: {
        staff_id: id,
      },
      include: {
        account: true,
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
}
