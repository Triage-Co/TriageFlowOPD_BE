import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { IPatientRepository } from '../interfaces/i-patient.repository';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrismaPatientRepository implements IPatientRepository {
  constructor(private readonly prismaService: PrismaService) {}
  findByCitizenId(citizenId: string): Promise<any> {
    return this.prismaService.patient.findFirst({
      where: {
        citizen_id: citizenId,
      },
      include: {
        account: {
          omit: {
            account_id: true,
            is_banned: true,
          },
        },
      },
    });
  }
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

  findAll(
    account_id?: string,
    page?: number,
    limit?: number,
    search?: string,
  ): Promise<any> {
    const skip =
      page && limit && page > 0 && limit > 0
        ? (Number(page) - 1) * Number(limit)
        : undefined;

    const take = limit && limit > 0 ? Number(limit) : undefined;

    return this.prismaService.patient.findMany({
      take: take,
      skip: skip,
      where: {
        ...(account_id && { account_id: account_id }),
        ...(search && {
          OR: [
            { citizen_id: { contains: search } },
            { full_name: { contains: search, mode: 'insensitive' } },
            { account: { phone: { contains: search } } },
            { account: { email: { contains: search, mode: 'insensitive' } } },
          ],
        }),
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
