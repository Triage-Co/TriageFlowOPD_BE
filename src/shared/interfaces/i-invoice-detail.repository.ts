import { Invoice_Detail, Prisma } from '@prisma/client';

export interface IInvoiceDetailRepository {
  create(
    data: Prisma.Invoice_DetailUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Invoice_Detail>;

  createMany(
    data: Prisma.Invoice_DetailUncheckedCreateInput[],
    tx?: Prisma.TransactionClient,
  ): Promise<Prisma.BatchPayload>;
}
