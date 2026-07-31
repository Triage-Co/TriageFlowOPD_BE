import { Injectable } from '@nestjs/common';
import { IInvoiceRepository } from '../interfaces/i-invoice.repository';
import { PrismaService } from '../config/prisma.service';
import { Invoice, Prisma } from '@prisma/client';

@Injectable()
export class PrismaInvoiceRepository implements IInvoiceRepository {
  constructor(private readonly prismaService: PrismaService) {}

  create(
    data: Prisma.InvoiceUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Invoice> {
    const db = tx || this.prismaService;
    return db.invoice.create({
      data,
    });
  }

  update(
    id: string,
    data: Prisma.InvoiceUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Invoice> {
    const db = tx || this.prismaService;
    return db.invoice.update({
      where: { invoice_id: id },
      data,
    });
  }

  findOne(id: string): Promise<Invoice | null> {
    return this.prismaService.invoice.findUnique({
      where: { invoice_id: id },
      include: {
        invoice_details: true,
      },
    });
  }
}
