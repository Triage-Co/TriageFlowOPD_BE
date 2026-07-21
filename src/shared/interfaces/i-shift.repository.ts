import { Booking, Prisma, Shift } from '@prisma/client';

export interface IShiftRepository {
  create(
    data: Prisma.ShiftUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Shift>;
}
