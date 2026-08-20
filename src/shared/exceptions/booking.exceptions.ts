import { HttpException, HttpStatus } from '@nestjs/common';

class BookingException extends HttpException {
  constructor(status: HttpStatus, message: string, detail: string) {
    super({ message, detail }, status);
  }
}

export const BookingErrors = {
  NotFoundById: (id: string) => {
    return new BookingException(
      HttpStatus.NOT_FOUND,
      'Không tìm thấy thông tin lịch hẹn',
      `Hệ thống chưa ghi nhận lịch hẹn khám có mã số ${id}. Quý khách vui lòng kiểm tra lại`,
    );
  },
};
