import { Booking, Prisma } from '@prisma/client';

export interface IBookingRepository {
  create(
    data: Prisma.BookingUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Booking>;

  findOne(id: string): Promise<Booking | null>;
  findMany(): Promise<Booking[]>;
}
