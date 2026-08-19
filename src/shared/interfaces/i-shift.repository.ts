import { Booking, Prisma, Shift } from '@prisma/client';

export interface IShiftRepository {
  create(
    data: Prisma.ShiftUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Shift>;

  findAll(
    page?: number,
    limit?: number,
    search?: string,
    staff_id?: string,
    room_id?: string,
    date?: string,
    start_time?: string,
    end_time?: string,
  ): Promise<any>;
}
