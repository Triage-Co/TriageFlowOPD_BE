import { HttpException, HttpStatus } from '@nestjs/common';

export class RoomServiceExceptions extends HttpException {
  constructor(status: HttpStatus, message: string, detail: string) {
    super({ message, detail }, status);
  }
}
export const RoomServiceErrors = {
  RoomServiceNotFoundById: (roomId?: string) =>
    new RoomServiceExceptions(
      HttpStatus.NOT_FOUND,
      'Không tìm thấy dịch vụ và giá tiền. Vui lòng kiểm tra lại',
      `Không tìm thấy dịch vụ và giá tiền ${roomId ? `tại phòng có ID: ${roomId}` : ''}`,
    ),
  ProviderError: (action: string, detail: string) =>
    new RoomServiceExceptions(HttpStatus.BAD_REQUEST, `Lỗi ${action}`, detail),
};
