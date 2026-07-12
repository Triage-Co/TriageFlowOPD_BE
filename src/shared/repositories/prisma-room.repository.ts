import { Injectable } from '@nestjs/common';
import { IRoomRepository } from '../interfaces/i-room.repository';
import { PrismaService } from '../config/prisma.service';

@Injectable()
export class PrismaRoomRepository implements IRoomRepository {
  constructor(private readonly prismaService: PrismaService) {}
  createMany(data: any): Promise<any> {
    return this.prismaService.room.createMany({
      data: {
        ...data,
      },
    });
  }

  create(data: any): Promise<any> {
    return this.prismaService.room.create({
      data: {
        ...data,
      },
    });
  }

  update(id: string, data: any): Promise<any> {
    return this.prismaService.room.update({
      data: {
        ...data,
      },
      where: {
        room_id: id,
      },
    });
  }

  findAll(): Promise<any> {
    return this.prismaService.room.findMany();
  }

  findById(id: string): Promise<any> {
    return this.prismaService.room.findUnique({
      where: {
        room_id: id,
      },
    });
  }

  delete(id: string): Promise<any> {
    return this.prismaService.room.delete({
      where: {
        room_id: id,
      },
    });
  }
}
