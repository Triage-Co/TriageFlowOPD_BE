import { Specialty } from '@prisma/client';
import { ISpecialtyRepository } from '../interfaces/i-specialty.repository';
import { PrismaService } from '../config/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PrismaSpecialtyRepository implements ISpecialtyRepository {
  constructor(private readonly prismaService: PrismaService) {}
  findOne(id: string): Promise<Specialty | null> {
    return this.prismaService.specialty.findFirst({
      where: {
        specialty_id: id,
      },
    });
  }
  findAll(page?: number, limit?: number): Promise<Partial<Specialty>[]> {
    const skip =
      page && limit && page > 0 && limit > 0
        ? (Number(page) - 1) * Number(limit)
        : undefined;

    const take = limit && limit > 0 ? Number(limit) : undefined;

    return this.prismaService.specialty.findMany({
      take: take,
      skip: skip,
      omit: {
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
