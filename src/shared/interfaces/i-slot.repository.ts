import { Booking, Prisma, Shift, Slot } from '@prisma/client';
export type SlotWithShiftAndRoom = Prisma.SlotGetPayload<{
  include: {
    shift: {
      include: {
        room: true;
        staff: true;
      };
    };
  };
}>;
export interface ISlotRepository {
  findAvailableSlots(
    specialtyId: string,
    currentHours: string,
    starOfDate: Date,
  ): Promise<{ slot_id: string }[]>;

  findOne(slotId: string): Promise<SlotWithShiftAndRoom>;

  update(
    slotId: string,
    data: Prisma.SlotUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Slot>;
}
