import { Injectable } from '@nestjs/common';
import { IRoomRepository } from '../interfaces/i-room.repository';
import { PrismaService } from '../config/prisma.service';
import { ClinicalRoomType, Room } from '@prisma/client';

@Injectable()
export class PrismaRoomRepository implements IRoomRepository {
  constructor(private readonly prismaService: PrismaService) {}
  countByType(type: ClinicalRoomType): Promise<number> {
    return this.prismaService.room.count({
      where: {
        room_type: type,
      },
    });
  }
  countAll(): Promise<number> {
    return this.prismaService.room.count();
  }
  findByType(type: ClinicalRoomType): Promise<Room[]> {
    return this.prismaService.room.findMany({
      where: {
        room_type: type,
      },
    });
  }
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
    return this.prismaService.room.findMany({
      include: {
        specialty: true,
      },
    });
  }

  findById(id: string): Promise<any> {
    return this.prismaService.room.findUnique({
      where: {
        room_id: id,
      },
      include: {
        specialty: true,
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
