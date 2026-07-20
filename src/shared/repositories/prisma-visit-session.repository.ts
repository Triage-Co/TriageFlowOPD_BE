import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { IVisitSessionRepository } from '../interfaces/i-visit-session.repository';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrismaVisitSessionRepository implements IVisitSessionRepository {
  constructor(private readonly prismaService: PrismaService) {}

  create(data: any, tx?: Prisma.TransactionClient): Promise<any> {
    const db = tx || this.prismaService;
    return db.visit_Session.create({
      data,
    });
  }

  update(id: string, data: any, tx?: Prisma.TransactionClient): Promise<any> {
    const db = tx || this.prismaService;
    return db.visit_Session.update({
      where: { visit_session_id: id },
      data,
    });
  }

  findAll(patient_id?: string): Promise<any> {
    return this.prismaService.visit_Session.findMany({
      where: {
        ...(patient_id && { patient_id }),
      },
      orderBy: {
        visit_date: 'desc',
      },
    });
  }

  findById(id: string): Promise<any> {
    return this.prismaService.visit_Session.findUnique({
      where: { visit_session_id: id },
      include: {
        patient: true,
        clinicalDocuments: true,
      },
    });
  }

  delete(id: string, tx?: Prisma.TransactionClient): Promise<any> {
    const db = tx || this.prismaService;
    return db.visit_Session.delete({
      where: { visit_session_id: id },
    });
  }
}
