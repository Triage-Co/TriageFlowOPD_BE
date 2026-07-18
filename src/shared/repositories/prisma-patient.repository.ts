import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { IPatientRepository } from '../interfaces/i-patient.repository';
import { Prisma } from '@prisma/client';

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
  update(
    patient_id: string,
    data: any,
    account_id?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<any> {
    const db = tx || this.prismaService;
    return db.patient.update({
      data: {
        ...data,
      },
      where: {
        patient_id: patient_id,
        ...(account_id && {
          account_id: account_id,
        }),
      },
    });
  }

  findAll(account_id?: string): Promise<any> {
    return this.prismaService.patient.findMany({
      where: {
        ...(account_id && { account_id: account_id }),
      },
    });
  }

  findOne(patient_id: string, account_id?: string): Promise<any> {
    return this.prismaService.patient.findFirst({
      where: {
        patient_id: patient_id,
        ...(account_id && {
          account_id: account_id,
        }),
      },
    });
  }

  delete(patient_id: string, account_id?: string): Promise<any> {
    return this.prismaService.patient.delete({
      where: {
        patient_id: patient_id,
        ...(account_id && {
          account_id: account_id,
        }),
      },
    });
  }

  create(
    account_id: string,
    data: any,
    tx?: Prisma.TransactionClient,
  ): Promise<any> {
    const db = tx || this.prismaService;

    return db.patient.create({
      data: {
        ...data,
        account_id: account_id,
      },
    });
  }
}
