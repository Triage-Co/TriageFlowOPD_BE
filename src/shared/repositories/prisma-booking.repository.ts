import { Prisma, Booking } from '@prisma/client';
import {
  BookingWithFlow,
  IBookingRepository,
} from '../interfaces/i-booking.repository';
import { PrismaService } from '../config/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PrismaBookingRepository implements IBookingRepository {
  constructor(private readonly prismaService: PrismaService) {}
  countBySlotId(slotId: string): Promise<number> {
    return this.prismaService.slot.count({
      where: {
        slot_id: slotId,
      },
    });
  }
  findOne(id: string): Promise<BookingWithFlow | null> {
    return this.prismaService.booking.findUnique({
      where: {
        booking_id: id,
      },
      include: {
        flow: {
          include: {
            steps: true,
          },
        },
      },
    });
  }
  findMany(): Promise<Booking[]> {
    return this.prismaService.booking.findMany();
  }
  create(
    data: Prisma.BookingUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Booking> {
    const db = tx || this.prismaService;
    return db.booking.create({
      data,
    });
  }
}
