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
      data,
    });
  }
}
