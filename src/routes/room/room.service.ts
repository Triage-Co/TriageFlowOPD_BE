import { Inject, Injectable } from '@nestjs/common';
import {
  CreateRoomRequestDto,
  UpdateRoomRequestDto,
} from './dto/request-room.dto';
import type { IRoomRepository } from '../../shared/interfaces/i-room.repository';
import { RoomErrors } from '../../shared/exceptions/room.exceptions';


@Injectable()
export class RoomService {
  constructor(
    @Inject('IRoomRepository') private readonly roomRepository: IRoomRepository,
  ) {}

  async create(createRoomRequestDto: CreateRoomRequestDto) {
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

  async findAll() {
    const data = await this.roomRepository.findAll();

    if (!data || data.length <= 0) {
      throw RoomErrors.RoomNotFound;
    }

    return {
      code: 200,
      message: 'Lấy danh sách phòng thành công',
      status: 'success',
      data: data,
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

    const dataUpdate = await this.roomRepository.update(
      id,
      updateRoomRequestDto,
    );

    return {
      code: 200,
      message: `cập nhật phòng với id ${id} thành công`,
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
