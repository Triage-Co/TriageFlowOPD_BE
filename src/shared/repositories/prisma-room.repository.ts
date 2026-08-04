import { Injectable } from '@nestjs/common';
import {
  IRoomRepository,
  RoomWithStaff,
} from '../interfaces/i-room.repository';
import { PrismaService } from '../config/prisma.service';
import { ClinicalRoomType, Prisma, Room } from '@prisma/client';
import { formatInTimeZone, toDate } from 'date-fns-tz';
import { QueryRoomReqDto } from '../../routes/room/dto/request-room.dto';

@Injectable()
export class PrismaRoomRepository implements IRoomRepository {
  constructor(private readonly prismaService: PrismaService) {}
  findBestRoomBySpecialtyId(
    specialty_id: string,
  ): Promise<RoomWithStaff | null> {
    const timeZone = 'Asia/Ho_Chi_Minh';
    const dateString = formatInTimeZone(new Date(), timeZone, 'yyyy-MM-dd');

    const start = toDate(`${dateString}T00:00:00`, { timeZone });
    const end = toDate(`${dateString}T23:59:59.999`, { timeZone });
    const time = formatInTimeZone(new Date(), timeZone, 'HH:mm:ss');
    return this.prismaService.room.findFirst({
      where: {
        specialty_id: specialty_id,
        shifts: {
          some: {
            date: {
              gte: start,
              lte: end,
            },
            slots: {
              some: {
                start_time: {
                  gte: time,
                },
                capacity: {
                  gt: 0,
                },
              },
            },
          },
        },
      },
      include: {
        shifts: {
          include: {
            staff: true,
            slots: {
              orderBy: [
                { capacity: 'desc' },
                { createdAt: 'asc' },
                { start_time: 'asc' },
              ],
            },
          },
        },
      },
    });
  }

  findBestRoomByRoomType(
    room_type: ClinicalRoomType,
  ): Promise<RoomWithStaff | null> {
    const timeZone = 'Asia/Ho_Chi_Minh';
    const dateString = formatInTimeZone(new Date(), timeZone, 'yyyy-MM-dd');

    const start = toDate(`${dateString}T00:00:00`, { timeZone });
    const end = toDate(`${dateString}T23:59:59.999`, { timeZone });
    const time = formatInTimeZone(new Date(), timeZone, 'HH:mm:ss');
    return this.prismaService.room.findFirst({
      where: {
        room_type: room_type,
        shifts: {
          some: {
            date: {
              gte: start,
              lte: end,
            },
            slots: {
              some: {
                start_time: {
                  gte: time,
                },
                capacity: {
                  gt: 0,
                },
              },
            },
          },
        },
      },
      include: {
        shifts: {
          include: {
            staff: true,
            slots: {
              orderBy: [
                { capacity: 'desc' },
                { createdAt: 'asc' },
                { start_time: 'asc' },
              ],
            },
          },
        },
      },
    });
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

  async findAll(query?: QueryRoomReqDto): Promise<{
    data: any[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const page = query?.page ? Number(query.page) : undefined;
    const limit = query?.limit ? Number(query.limit) : undefined;
    const isPaginated =
      page !== undefined && limit !== undefined && page > 0 && limit > 0;

    const where: Prisma.RoomWhereInput = {};

    if (query?.room_type) {
      where.room_type = query.room_type;
    }

    if (query?.search) {
      where.room_name = {
        contains: query.search,
        mode: 'insensitive',
      };
    }

    const sortBy = query?.sortBy || 'created_at';
    const sortOrder = query?.sortOrder || 'desc';

    const findOptions: Prisma.RoomFindManyArgs = {
      where,
      include: {
        specialty: true,
        physical_room: true,
      },
      orderBy: {
        [sortBy]: sortOrder,
      },
    };

    if (isPaginated) {
      findOptions.skip = (page - 1) * limit;
      findOptions.take = limit;
    }

    const dataQuery = this.prismaService.room.findMany(findOptions);
    const countQuery = this.prismaService.room.count({ where });

    const [data, total] = await this.prismaService.$transaction([
      dataQuery,
      countQuery,
    ]);

    const activePage = isPaginated ? page : 1;
    const activeLimit = isPaginated ? limit : total > 0 ? total : 10;

    return {
      data,
      meta: {
        total,
        page: activePage,
        limit: activeLimit,
        totalPages: isPaginated ? Math.ceil(total / activeLimit) : 1,
      },
    };
  }

  findById(id: string): Promise<any> {
    return this.prismaService.room.findUnique({
      where: {
        room_id: id,
      },
      include: {
        specialty: true,
        physical_room: true,
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
