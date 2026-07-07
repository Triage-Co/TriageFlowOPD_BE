import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { IStaffRepository } from '../interfaces/i-staff.repository';

@Injectable()
export class PrismaStaffRepository implements IStaffRepository {
  constructor(private readonly prismaService: PrismaService) {}

  create(id: string): Promise<any> {
    return this.prismaService.staff.create({
      data: {
        staff_id: id,
      },
    });
  }
}
