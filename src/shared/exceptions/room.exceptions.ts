import { HttpException, HttpStatus } from '@nestjs/common';

export class RoomException extends HttpException {
  constructor(status: HttpStatus, message: string, detail: any) {
    super({ message, detail }, status);
  }
}

export const RoomErrors = {
  RoomNotFoundById: (room_id: string) =>
    new RoomException(
      HttpStatus.NOT_FOUND,
      'Không tìm thấy phòng',
      `Không tìm thấy phòng với id: ${room_id} trong hệ thống`,
    ),
  RoomNotFound: new RoomException(
    HttpStatus.NOT_FOUND,
    'Không tìm thấy phòng',
    `Không tìm thấy phòng trong hệ thống`,
  ),
  PhysicalRoomNotFoundById: (physical_room_id: string) =>
    new RoomException(
      HttpStatus.NOT_FOUND,
      'Không tìm thấy phòng vật lý',
      `Không tìm thấy phòng vật lý (PhysicalRoom) với id: ${physical_room_id} trong hệ thống`,
    ),
  ProviderError: (action: string, detail: string) =>
    new RoomException(HttpStatus.BAD_REQUEST, `Lỗi ${action}`, detail),
};

