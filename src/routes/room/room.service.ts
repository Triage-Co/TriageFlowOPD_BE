import { Inject, Injectable } from '@nestjs/common';
import {
  CreateRoomRequestDto,
  QueryRoomReqDto,
  UpdateRoomRequestDto,
} from './dto/request-room.dto';
import type { IRoomRepository } from '../../shared/interfaces/i-room.repository';
import { RoomErrors } from '../../shared/exceptions/room.exceptions';
import { PrismaService } from '../../shared/config/prisma.service';

@Injectable()
export class RoomService {
  constructor(
    @Inject('IRoomRepository') private readonly roomRepository: IRoomRepository,
    private readonly prismaService: PrismaService,
  ) {}

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
    const data = await this.roomRepository.findById(id);

    if (!data) {
      throw RoomErrors.RoomNotFoundById(id);
    }

    if (
      updateRoomRequestDto.physical_room_id !== undefined &&
      updateRoomRequestDto.physical_room_id !== null
    ) {
      const physicalRoom = await this.prismaService.physicalRoom.findUnique({
        where: { id: updateRoomRequestDto.physical_room_id },
      });
      if (!physicalRoom) {
        throw RoomErrors.PhysicalRoomNotFoundById(
          updateRoomRequestDto.physical_room_id,
        );
      }
    }

    const dataUpdate = await this.roomRepository.update(
      id,
      updateRoomRequestDto,
    );

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

    return {
      code: 200,
      message: `Xóa phòng với id ${id} thành công`,
      status: 'success',
    };
  }
}
