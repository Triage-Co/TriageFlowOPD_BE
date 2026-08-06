import { PrismaService } from '../config/prisma.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ISlotRepository,
  SlotWithShiftAndRoom,
} from '../interfaces/i-slot.repository';
import { formatInTimeZone, toDate } from 'date-fns-tz';
import { Prisma, Slot } from '@prisma/client';

@Injectable()
export class PrismaSlotRepository implements ISlotRepository {
  constructor(private readonly prismaService: PrismaService) {}
  findAvailableBySlotId(slotId: string): Promise<SlotWithShiftAndRoom | null> {
    const timeZone = 'asia/Ho_Chi_Minh';
    const now = new Date();
    const currentHours = formatInTimeZone(now, timeZone, 'HH:mm');
    const targetDate = formatInTimeZone(now, timeZone, 'yyyy-MM-dd');
    const startOfToday = toDate(`${targetDate}T00:00:00`, { timeZone });
    return this.prismaService.slot.findFirst({
      where:{
        slot_id: slotId,
        capacity: {
          gt: 0,
        },
        OR:[
          {
            shift: {
              date: startOfToday,
              start_time: {
                gt: currentHours,
              },
            },
          },
          {
            shift: {
              date: {
                gt: startOfToday,
              },
            },
          },
        ],
      },
      include: {
        shift: {
          include: {
            room: true,
            staff: true,
          },
        },
      },
    })
  }
  
  update(
    slotId: string,
    data: Prisma.SlotUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Slot> {
    const db = tx || this.prismaService;
    return db.slot.update({
      where: {
        slot_id: slotId,
      },
      data: data,
    });
  }

  async findOne(slotId: string): Promise<SlotWithShiftAndRoom> {
    const timeZone = 'Asia/Ho_Chi_Minh';
    const targetDate = formatInTimeZone(new Date(), timeZone, 'yyyy-MM-dd');
    const targetTime = formatInTimeZone(new Date(), timeZone, 'HH:mm');
    const startOfToday = toDate(`${targetDate}T00:00:00`, { timeZone });

    const data = await this.prismaService.slot.findFirst({
      where: {
        slot_id: slotId,
        OR: [
          {
            shift: {
              date: startOfToday,
            },
            start_time: {
              gt: targetTime,
            },
          },
          {
            shift: {
              date: {
                gt: startOfToday,
              },
            },
          },
        ],
      },
      include: {
        shift: {
          include: {
            room: true,
            staff: true,
          },
        },
      },
    });
    if (!data) {
      throw new NotFoundException('Không tìm thấy ca trực phù hợp');
    }
    return data;
  }

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
