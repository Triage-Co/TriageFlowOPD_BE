import { Prisma, Booking } from '@prisma/client';
import { IBookingRepository } from '../interfaces/i-booking.repository';
import { PrismaService } from '../config/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PrismaBookingRepository implements IBookingRepository {
  constructor(private readonly prismaService: PrismaService) {}
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
