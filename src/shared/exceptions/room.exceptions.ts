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
  NotFoundByType: (type: string) => {
    return new RoomException(
      HttpStatus.NOT_FOUND,
      'Không tìm thấy phòng chức năng phù hợp',
      `Hệ thống không thể phân bổ phòng trống cho loại dịch vụ y tế [${type}]. Vui lòng kiểm tra lại cấu hình phòng hoặc liên hệ bộ phận quản trị.`,
    );
  },
  ProviderError: (action: string, detail: string) =>
    new RoomException(HttpStatus.BAD_REQUEST, `Lỗi ${action}`, detail),
};
