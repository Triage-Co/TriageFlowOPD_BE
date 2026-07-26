import { Booking, Prisma, Shift } from '@prisma/client';

export interface ISlotRepository {
  findAvailableSlots(
    specialtyId: string,
    currentHours: string,
    starOfDate: Date,
  ): Promise<{ slot_id: string }[]>;
}
