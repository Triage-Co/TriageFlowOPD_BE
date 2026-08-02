import { Invoice, Prisma } from '@prisma/client';

export interface IInvoiceRepository {
  create(
    data: Prisma.InvoiceUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Invoice>;

  update(
    id: string,
    data: Prisma.InvoiceUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Invoice>;

  findOne(id: string): Promise<Invoice | null>;

  findByServiceOrderId(serviceOrderId: string): Promise<Invoice | null>;

  delete(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Invoice>;
}
