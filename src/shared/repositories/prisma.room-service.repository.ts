import { Injectable } from '@nestjs/common';
import {
  IRoomServiceRepository,
  RoomServiceWithRoomAndService,
} from '../interfaces/i-room-service.repository';
import { PrismaService } from '../config/prisma.service';

@Injectable()
export class PrismaRoomServiceRepository implements IRoomServiceRepository {
  constructor(private readonly prismaService: PrismaService) {}

  findOneByRoomId(
    roomId: string,
  ): Promise<RoomServiceWithRoomAndService | null> {
    return this.prismaService.room_Service.findFirst({
      where: {
        room_id: roomId,
        is_active: true,
        service: { is_active: true },
      },
      include: {
        room: true,
        service: true,
      },
    });
  }
}
