import { HttpException, HttpStatus } from '@nestjs/common';

export class ServiceOrderDetailException extends HttpException {
  constructor(status: HttpStatus, message: string, detail: string) {
    super(
      {
        message,
        detail,
      },
      status,
    );
  }
}

export const ServiceOrderDetailErrors = {
  ServiceOrderDetailNotFoundById: (id: string) =>
    new ServiceOrderDetailException(
      HttpStatus.NOT_FOUND,
      'Không tìm thấy thông tin chi tiết dịch vụ',
      `Hệ thống chưa ghi nhận thông tin chi tiết dịch vụ có mã số ${id}. Quý khách vui lòng kiểm tra lại thông tin.`,
    ),

  ServiceOrderDetailDuplicates: () =>
    new ServiceOrderDetailException(
      HttpStatus.CONFLICT,
      'Mã dịch vụ đã tồn tại',
      `Một số mã dịch vụ y tế đã được ghi nhận trên hệ thống. Quý khách vui lòng sử dụng mã khác hoặc kiểm tra lại.`,
    ),

  ActionFailed: (action: string, errorDetail?: string) =>
    new ServiceOrderDetailException(
      HttpStatus.BAD_REQUEST,
      `Không thể hoàn tất yêu cầu: ${action}`,
      errorDetail ??
        `Quá trình xử lý tác vụ "${action.toLowerCase()}" đang bị gián đoạn. Quý khách vui lòng thử lại sau ít phút.`,
    ),
};
