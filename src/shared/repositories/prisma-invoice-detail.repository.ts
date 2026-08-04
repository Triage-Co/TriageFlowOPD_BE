import { Injectable } from '@nestjs/common';
import { IInvoiceDetailRepository } from '../interfaces/i-invoice-detail.repository';
import { PrismaService } from '../config/prisma.service';
import { Invoice_Detail, Prisma } from '@prisma/client';

@Injectable()
export class PrismaInvoiceDetailRepository implements IInvoiceDetailRepository {
  constructor(private readonly prismaService: PrismaService) {}

  create(
    data: Prisma.Invoice_DetailUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Invoice_Detail> {
    const db = tx || this.prismaService;
    return db.invoice_Detail.create({
      data,
    });
  }

  createMany(
    data: Prisma.Invoice_DetailUncheckedCreateInput[],
    tx?: Prisma.TransactionClient,
  ): Promise<Prisma.BatchPayload> {
    const db = tx || this.prismaService;
    return db.invoice_Detail.createMany({
      data,
    });
  }

  update(
    id: string,
    data: Prisma.Invoice_DetailUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Invoice_Detail> {
    const db = tx || this.prismaService;
    return db.invoice_Detail.update({
      where: { invoice_detail_id: id },
      data,
    });
  }

  delete(id: string, tx?: Prisma.TransactionClient): Promise<Invoice_Detail> {
    const db = tx || this.prismaService;
    return db.invoice_Detail.delete({
      where: { invoice_detail_id: id },
    });
  }
}
