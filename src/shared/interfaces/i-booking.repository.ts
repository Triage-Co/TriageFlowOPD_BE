import { Booking, Prisma } from '@prisma/client';

export type BookingWithFlow = Prisma.BookingGetPayload<{
  include: {
    flow: {
      include: {
        steps: true;
      };
    };
  };
}>;
export interface IBookingRepository {
  create(
    data: Prisma.BookingUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Booking>;

  findOne(id: string): Promise<BookingWithFlow | null>;
  findMany(): Promise<Booking[]>;
  countBySlotId(slotId: string): Promise<number>;
}
