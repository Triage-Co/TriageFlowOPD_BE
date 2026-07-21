import { Prisma, Booking, Shift } from '@prisma/client';
import { IBookingRepository } from '../interfaces/i-booking.repository';
import { PrismaService } from '../config/prisma.service';
import { IShiftRepository } from '../interfaces/i-shift.repository';

export class PrismaShiftRepository implements IShiftRepository {
  constructor(private readonly prismaService: PrismaService) {}
  create(
    data: Prisma.ShiftUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Shift> {
    const db = tx || this.prismaService;
    return db.shift.create({
      data: {
        room_id: data.room_id,
        shift_id: data.shift_id,
        staff_id: data.staff_id,
        start_time: data.staff_id,
        end_time: data.end_time,
        date: data.date,
      },
    });
  }
}
