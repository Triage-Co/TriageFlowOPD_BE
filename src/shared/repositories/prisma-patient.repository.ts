import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { IPatientRepository } from '../interfaces/i-patient.repository';

@Injectable()
export class PrismaPatientRepository implements IPatientRepository {
  constructor(private readonly prismaService: PrismaService) {}

  create(data: any): Promise<any> {
    return this.prismaService.patient.create({
      data: {
        ...data,
      },
    });
  }
}
