import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { IStaffRepository } from '../interfaces/i-staff.repository';
import { Prisma, RoleTypeEnum, Service } from '@prisma/client';
import { IServiceOrderRepository } from '../interfaces/i-service-order.repository';
import { IServiceRepository } from '../interfaces/i-service.repository';

@Injectable()
export class PrismaServiceRepository implements IServiceRepository {
  constructor(private readonly prismaService: PrismaService) {}
  create(data: Prisma.ServiceUncheckedCreateInput, tx?: Prisma.TransactionClient): Promise<Service> {
    throw new Error('Method not implemented.');
  }
  update(id: string, data: Prisma.ServiceUncheckedUpdateInput, tx?: Prisma.TransactionClient): Promise<Service> {
    throw new Error('Method not implemented.');
  }
  findAll(): Promise<Partial<Service>[]> {
    throw new Error('Method not implemented.');
  }
  findById(id: string): Promise<Partial<Service>> {
    throw new Error('Method not implemented.');
  }
  
}
