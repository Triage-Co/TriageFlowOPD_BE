import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { IStaffRepository } from '../interfaces/i-staff.repository';
import { Prisma, RoleTypeEnum, Service_Order } from '@prisma/client';
import { IServiceOrderRepository } from '../interfaces/i-service-order.repository';

@Injectable()
export class PrismaServiceOrderRepository implements IServiceOrderRepository {
  constructor(private readonly prismaService: PrismaService) {}
  create(
    data: Prisma.Service_OrderUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Service_Order> {
    throw new Error('Method not implemented.');
  }
  update(
    id: string,
    data: Prisma.Service_OrderUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Service_Order> {
    throw new Error('Method not implemented.');
  }
  findAll(): Promise<Partial<Service_Order>[]> {
    throw new Error('Method not implemented.');
  }
  findById(id: string): Promise<Partial<Service_Order>> {
    throw new Error('Method not implemented.');
  }
}
