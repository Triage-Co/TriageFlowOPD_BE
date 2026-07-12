import { Injectable } from '@nestjs/common';
import { IRoomRepository } from '../interfaces/i-room.repository';
import { PrismaService } from '../config/prisma.service';
import { IQueueRepository } from '../interfaces/i-queue.repository';

@Injectable()
export class PrismaQueueRepository implements IQueueRepository {
  constructor(private readonly prismaService: PrismaService) {}
  findByStepId(id: string): Promise<any> {
    return this.prismaService.queue.findFirst({
      where: {
        step_id: id,
      },
    });
  }
}
