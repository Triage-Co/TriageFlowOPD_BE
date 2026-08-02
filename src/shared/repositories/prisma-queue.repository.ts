import { Prisma, Booking, Queue } from '@prisma/client';
import { IBookingRepository } from '../interfaces/i-booking.repository';
import { PrismaService } from '../config/prisma.service';
import { Injectable } from '@nestjs/common';
import { IQueueRepository } from '../interfaces/i-queue.repository';

@Injectable()
export class PrismaQueueRepository implements IQueueRepository {
  constructor(private readonly prismaService: PrismaService) {}
  create(
    data: Prisma.QueueUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Queue> {
    const db = tx || this.prismaService;
    return db.queue.create({
      data: data,
    });
  }
  update(
    id: string,
    data: Prisma.QueueUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Queue> {
    const db = tx || this.prismaService;

    return db.queue.update({
      where: {
        queue_id: id,
      },
      data: data,
    });
  }
  findOne(id: string): Promise<Queue | null> {
    return this.prismaService.queue.findFirst({
      where: {
        queue_id: id,
      },
    });
  }
  delete(id: string): Promise<Queue | null> {
    return this.prismaService.queue.delete({
      where: {
        queue_id: id,
      },
    });
  }
  findMany(): Promise<Queue[]> {
    return this.prismaService.queue.findMany();
  }
}
