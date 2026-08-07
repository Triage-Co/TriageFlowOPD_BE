import { HttpException, HttpStatus } from '@nestjs/common';

export class SlotExceptions extends HttpException {
  constructor(status: HttpStatus, message: string, detail: string) {
    super({ message, detail }, status);
  }
}
export const SlotErrors = {
  NotFoundAvailableSlot: (slotId: string) =>
    new SlotExceptions(
      HttpStatus.NOT_FOUND,
      'Khung giờ này hiện đã kín chỗ hoặc quá thời gian đặt khám. Vui lòng chọn khung giờ khác',
      `Khung giờ bạn chọn ID: ${slotId} hiện không thể đặt Vui lòng thử lại với slot khác.`,
    ),
  SlotFullError: () =>
    new SlotExceptions(
      HttpStatus.BAD_REQUEST,
      'Khung giờ này hiện đã kín chỗ',
      'Khung giờ này hiện đã kín chỗ',
    ),
  ProviderError: (action: string, detail: string) =>
    new SlotExceptions(HttpStatus.BAD_REQUEST, `Lỗi ${action}`, detail),
};
