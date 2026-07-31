import { Injectable } from '@nestjs/common';
import { IRoomRepository, RoomWithStaff } from '../interfaces/i-room.repository';
import { PrismaService } from '../config/prisma.service';
import { ClinicalRoomType, Room } from '@prisma/client';
import { formatInTimeZone, toDate } from 'date-fns-tz';

@Injectable()
export class PrismaRoomRepository implements IRoomRepository {
  constructor(private readonly prismaService: PrismaService) { }
  findBestRoomBySpecialtyId(specialty_id: string): Promise<RoomWithStaff | null> {
    const timeZone = "Asia/Ho_Chi_Minh"
    const dateString = formatInTimeZone(new Date(), timeZone, 'yyyy-MM-dd');

    const start = toDate(`${dateString}T00:00:00`, { timeZone });
    const end = toDate(`${dateString}T23:59:59.999`, { timeZone });
    const time = formatInTimeZone(new Date(), timeZone, 'HH:mm:ss')
    return this.prismaService.room.findFirst({
      where: {
        specialty_id: specialty_id,
        shifts: {
          some: {
            date: {
              gte: start,
              lte: end
            },
            slots: {
              some: {
                start_time: {
                  gte: time
                },
                capacity: {
                  gt: 0
                }
              }
            }
          }
        }
      },
      include: {
        shifts: {
          include: {
            staff: true,
            slots: {
              orderBy: [
                { capacity: "desc" },
                { createdAt: "asc" },
                { start_time: "asc" },
              ]
            }
          }
        }
      }
    })
  }

  findBestRoomByRoomType(room_type: ClinicalRoomType): Promise<RoomWithStaff | null> {
    const timeZone = "Asia/Ho_Chi_Minh"
    const dateString = formatInTimeZone(new Date(), timeZone, 'yyyy-MM-dd');

    const start = toDate(`${dateString}T00:00:00`, { timeZone });
    const end = toDate(`${dateString}T23:59:59.999`, { timeZone });
    const time = formatInTimeZone(new Date(), timeZone, 'HH:mm:ss')
    return this.prismaService.room.findFirst({
      where: {
        room_type: room_type,
        shifts: {
          some: {
            date: {
              gte: start,
              lte: end
            },
            slots: {
              some: {
                start_time: {
                  gte: time
                },
                capacity: {
                  gt: 0
                }
              }
            }
          }
        }
      },
      include: {
        shifts: {
          include: {
            staff: true,
            slots: {
              orderBy: [
                { capacity: "desc" },
                { createdAt: "asc" },
                { start_time: "asc" },
              ]
            }
          }
        }
      }
    })
  }
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
