import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import {
  CreateRoomRequestDto,
  QueryRoomReqDto,
  UpdateRoomRequestDto,
} from './dto/request-room.dto';
import type { IRoomRepository } from '../../shared/interfaces/i-room.repository';
import { RoomErrors } from '../../shared/exceptions/room.exceptions';
import { PrismaService } from '../../shared/config/prisma.service';
import { formatInTimeZone, toDate } from 'date-fns-tz';

@Injectable()
export class RoomService {
  constructor(
    @Inject('IRoomRepository') private readonly roomRepository: IRoomRepository,
    private readonly prismaService: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  private async clearBuildingCacheByPhysicalRoomId(
    physicalRoomId: string | null | undefined,
  ) {
    if (!physicalRoomId) return;
    try {
      const physicalRoom = await this.prismaService.physicalRoom.findUnique({
        where: { id: physicalRoomId },
        select: { floorId: true },
      });
      if (physicalRoom?.floorId) {
        const floor = await this.prismaService.floor.findUnique({
          where: { id: physicalRoom.floorId },
          select: { buildingId: true },
        });
        if (floor?.buildingId) {
          await this.cacheManager.del(`building_map:${floor.buildingId}`);
          await this.cacheManager.del(`nav_graph:${floor.buildingId}`);
        }
      }
    } catch (err) {
      console.warn('Failed to clear building map cache:', err);
    }
  }

  async create(createRoomRequestDto: CreateRoomRequestDto) {
    if (createRoomRequestDto.physical_room_id) {
      const physicalRoom = await this.prismaService.physicalRoom.findUnique({
        where: { id: createRoomRequestDto.physical_room_id },
      });
      if (!physicalRoom) {
        throw RoomErrors.PhysicalRoomNotFoundById(
          createRoomRequestDto.physical_room_id,
        );
      }
    }

    const data = await this.roomRepository.create(createRoomRequestDto);

    if (createRoomRequestDto.physical_room_id && createRoomRequestDto.room_name?.trim()) {
      await this.prismaService.physicalRoom.update({
        where: { id: createRoomRequestDto.physical_room_id },
        data: { roomLabel: createRoomRequestDto.room_name.trim() },
      });
      await this.clearBuildingCacheByPhysicalRoomId(createRoomRequestDto.physical_room_id);
    }

    return {
      code: 200,
      message: 'Tạo phòng thành công',
      status: 'success',
      data: data,
    };
  }

  async createMany(createRoomRequestDto: CreateRoomRequestDto[]) {
    const data = await this.roomRepository.create(createRoomRequestDto);

    return {
      code: 200,
      message: 'Tạo phòng thành công',
      status: 'success',
      data: data,
    };
  }

  async findAll(query?: QueryRoomReqDto) {
    const result = await this.roomRepository.findAll(query);

    if (!result.data || result.data.length <= 0) {
      throw RoomErrors.RoomNotFound;
    }

    return {
      code: 200,
      message: 'Lấy danh sách phòng thành công',
      status: 'success',
      data: result.data,
      meta: result.meta,
    };
  }

  async findOne(id: string) {
    const data = await this.roomRepository.findById(id);

    if (!data) {
      throw RoomErrors.RoomNotFoundById(id);
    }
    return {
      code: 200,
      message: `Lấy phòng với id ${id} thành công`,
      status: 'success',
      data: data,
    };
  }

  async update(id: string, updateRoomRequestDto: UpdateRoomRequestDto) {
    const existingRoom = await this.roomRepository.findById(id);

    if (!existingRoom) {
      throw RoomErrors.RoomNotFoundById(id);
    }

    const targetPhysicalRoomId =
      updateRoomRequestDto.physical_room_id !== undefined
        ? updateRoomRequestDto.physical_room_id
        : existingRoom.physical_room_id;

    if (targetPhysicalRoomId) {
      const physicalRoom = await this.prismaService.physicalRoom.findUnique({
        where: { id: targetPhysicalRoomId },
      });
      if (!physicalRoom) {
        throw RoomErrors.PhysicalRoomNotFoundById(targetPhysicalRoomId);
      }
    }

    const dataUpdate = await this.roomRepository.update(
      id,
      updateRoomRequestDto,
    );

    const newRoomName =
      updateRoomRequestDto.room_name?.trim() || dataUpdate?.room_name;
    if (targetPhysicalRoomId && newRoomName) {
      await this.prismaService.physicalRoom.update({
        where: { id: targetPhysicalRoomId },
        data: { roomLabel: newRoomName },
      });
    }

    if (existingRoom.physical_room_id) {
      await this.clearBuildingCacheByPhysicalRoomId(existingRoom.physical_room_id);
    }
    if (
      targetPhysicalRoomId &&
      targetPhysicalRoomId !== existingRoom.physical_room_id
    ) {
      await this.clearBuildingCacheByPhysicalRoomId(targetPhysicalRoomId);
    }

    return {
      code: 200,
      message: `Cập nhật phòng với id ${id} thành công`,
      status: 'success',
      data: dataUpdate,
    };
  }

  async remove(id: string) {
    const data = await this.roomRepository.findById(id);

    if (!data) {
      throw RoomErrors.RoomNotFoundById(id);
    }

    await this.roomRepository.delete(id);

    if (data.physical_room_id) {
      await this.clearBuildingCacheByPhysicalRoomId(data.physical_room_id);
    }

    return {
      code: 200,
      message: `Xóa phòng với id ${id} thành công`,
      status: 'success',
    };
  }

  async getSlotsByRoomId(roomId: string, dateStr?: string) {
    const room = await this.roomRepository.findById(roomId);
    if (!room) {
      throw RoomErrors.RoomNotFoundById(roomId);
    }

    const whereCondition: any = {
      shift: {
        room_id: roomId,
      },
    };

    if (dateStr) {
      const timeZone = 'Asia/Ho_Chi_Minh';
      const targetDate = new Date(dateStr);
      const dateFormatted = formatInTimeZone(
        targetDate,
        timeZone,
        'yyyy-MM-dd',
      );
      const start = toDate(`${dateFormatted}T00:00:00`, { timeZone });
      const end = toDate(`${dateFormatted}T23:59:59.999`, { timeZone });
      whereCondition.shift.date = {
        gte: start,
        lte: end,
      };
    }

    const slots = await this.prismaService.slot.findMany({
      where: whereCondition,
      include: {
        shift: true,
      },
      orderBy: [{ shift: { date: 'asc' } }, { start_time: 'asc' }],
    });

    return {
      code: 200,
      message: 'Thành công',
      status: 'success',
      data: slots,
    };
  }
}
