import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { IClinicalDocumentRepository } from '../interfaces/i-clinical-document.repository';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrismaClinicalDocumentRepository implements IClinicalDocumentRepository {
  constructor(private readonly prismaService: PrismaService) {}

  create(data: any, tx?: Prisma.TransactionClient): Promise<any> {
    const db = tx || this.prismaService;
    return db.clinical_Document.create({
      data,
    });
  }

  update(id: string, data: any, tx?: Prisma.TransactionClient): Promise<any> {
    const db = tx || this.prismaService;
    return db.clinical_Document.update({
      where: { clinical_document_id: id },
      data,
    });
  }

  findAll(visit_session_id?: string): Promise<any> {
    return this.prismaService.clinical_Document.findMany({
      where: {
        ...(visit_session_id && { visit_session_id }),
      },
    });
  }

  findById(id: string): Promise<any> {
    return this.prismaService.clinical_Document.findUnique({
      where: { clinical_document_id: id },
      include: {
        visitSession: {
          include: {
            patient: true,
          },
        },
      },
    });
  }

  delete(id: string, tx?: Prisma.TransactionClient): Promise<any> {
    const db = tx || this.prismaService;
    return db.clinical_Document.delete({
      where: { clinical_document_id: id },
    });
  }
}
