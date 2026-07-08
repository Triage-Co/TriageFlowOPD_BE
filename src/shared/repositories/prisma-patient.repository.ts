import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { IPatientRepository } from '../interfaces/i-patient.repository';

@Injectable()
export class PrismaPatientRepository implements IPatientRepository {
  constructor(private readonly prismaService: PrismaService) {}
  findOneWithPatientId(patient_id: string): Promise<any> {
    return this.prismaService.patient.findUnique({
      where: {
        patient_id: patient_id,
      },
    });
  }
  update(account_id: string, patient_id: string, data: any): Promise<any> {
    return this.prismaService.patient.update({
      data: {
        ...data,
      },
      where: {
        patient_id: patient_id,
        account_id: account_id,
      },
    });
  }

  findAll(account_id: string): Promise<any> {
    return this.prismaService.patient.findMany({
      where: {
        account_id: account_id,
      },
    });
  }

  findOne(account_id: string, patient_id: string): Promise<any> {
    return this.prismaService.patient.findUnique({
      where: {
        patient_id: patient_id,
        account_id: account_id,
      },
    });
  }
  delete(account_id: string, patient_id: string): Promise<any> {
    return this.prismaService.patient.delete({
      where: {
        patient_id: patient_id,
        account_id: account_id,
      },
    });
  }

  create(account_id: string, data: any): Promise<any> {
    return this.prismaService.patient.create({
      data: {
        ...data,
        account_id: account_id,
      },
    });
  }
}
