import { HttpException, HttpStatus } from '@nestjs/common';

export class ServiceOrderException extends HttpException {
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

export const ServiceOrderErrors = {
  ServiceOrderNotFoundById: (id: string) =>
    new ServiceOrderException(
      HttpStatus.NOT_FOUND,
      'Không tìm thấy Service Order',
      `Không tìm thấy Service Order với id: ${id}.`,
    ),

  CreateFailed: () =>
    new ServiceOrderException(
      HttpStatus.BAD_REQUEST,
      'Tạo Service Order thất bại',
      'Đã xảy ra lỗi khi tạo Service Order.',
    ),

  UpdateFailed: (id: string) =>
    new ServiceOrderException(
      HttpStatus.BAD_REQUEST,
      'Cập nhật Service Order thất bại',
      `Không thể cập nhật Service Order ${id}.`,
    ),

  DeleteFailed: (id: string) =>
    new ServiceOrderException(
      HttpStatus.BAD_REQUEST,
      'Xóa Service Order thất bại',
      `Không thể xóa Service Order ${id}.`,
    ),

  ActionFailed: (action: string, detail?: string) =>
    new ServiceOrderException(
      HttpStatus.BAD_REQUEST,
      `${action} không thành công`,
      detail ?? `Đã xảy ra lỗi khi ${action.toLowerCase()}.`,
    ),
};
