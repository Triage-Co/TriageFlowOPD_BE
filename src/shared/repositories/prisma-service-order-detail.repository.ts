import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { IStaffRepository } from '../interfaces/i-staff.repository';
import { Prisma, RoleTypeEnum, Service_Order_Detail } from '@prisma/client';
import { IServiceOrderDetailRepository } from '../interfaces/i-service-order-detail.repository';

@Injectable()
export class PrismaServiceOrderDetailRepository implements IServiceOrderDetailRepository {
  constructor(private readonly prismaService: PrismaService) {}
  create(data: Prisma.Service_Order_DetailUncheckedCreateInput, tx?: Prisma.TransactionClient): Promise<Service_Order_Detail> {
    throw new Error('Method not implemented.');
  }
  update(id: string, data: Prisma.Service_Order_DetailUncheckedUpdateInput, tx?: Prisma.TransactionClient): Promise<Service_Order_Detail> {
    throw new Error('Method not implemented.');
  }
  findAll(): Promise<Partial<Service_Order_Detail>[]> {
    throw new Error('Method not implemented.');
  }
  findById(id: string): Promise<Partial<Service_Order_Detail>> {
    throw new Error('Method not implemented.');
  }
 

  
}
