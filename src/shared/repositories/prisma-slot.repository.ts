import { Prisma, Booking, Shift } from '@prisma/client';
import { IBookingRepository } from '../interfaces/i-booking.repository';
import { PrismaService } from '../config/prisma.service';
import { Injectable } from '@nestjs/common';
import { ISlotRepository } from '../interfaces/i-slot.repository';

@Injectable()
export class PrismaSlotRepository implements ISlotRepository {
  constructor(private readonly prismaService: PrismaService) {}
  async findAvailableSlots(
    specialtyId: string,
    currentHours: string,
    starOfDate: Date,
  ): Promise<{ slot_id: string }[]> {
    return await this.prismaService.slot.findMany({
      where: {
        capacity: {
          gt: 0,
        },
        shift: {
          room: {
            specialty_id: specialtyId,
          },
        },
        OR: [
          {
            shift: {
              date: starOfDate,
            },
            start_time: {
              gt: currentHours,
            },
          },
          {
            shift: {
              date: {
                gt: starOfDate,
              },
            },
          },
        ],
      },
      select: {
        slot_id: true,
      },
      orderBy: [
        {
          shift: {
            date: 'asc',
          },
        },
        {
          start_time: 'asc',
        },
        {
          capacity: 'desc',
        },
      ],
    });
  }
}
