import { HttpException, HttpStatus } from '@nestjs/common';

export class ServiceException extends HttpException {
  constructor(status: HttpStatus, message: string, detail: string) {
    super({ message, detail }, status);
  }
}

export const ServiceErrors = {
  ServiceExists: (code: string) =>
    new ServiceException(
      HttpStatus.CONFLICT,
      'Dịch vụ đã tồn tại',
      `Mã dịch vụ: ${code} đã được sử dụng trong hệ thống.`,
    ),
  ServiceNotFoundById: (id: string) =>
    new ServiceException(
      HttpStatus.NOT_FOUND,
      'Không tìm thấy dịch vụ',
      `Không tìm thấy dịch vụ với id: ${id} trong hệ thống.`,
    ),
  ServiceNotFoundByCode: (code: string) =>
    new ServiceException(
      HttpStatus.NOT_FOUND,
      'Không tìm thấy dịch vụ',
      `Không tìm thấy dịch vụ với mã: ${code} trong hệ thống.`,
    ),
  CreateFailed: () =>
    new ServiceException(
      HttpStatus.BAD_REQUEST,
      'Tạo dịch vụ không thành công',
      'Đã xảy ra lỗi trong quá trình tạo dịch vụ mới.',
    ),
  UpdateFailed: (id: string) =>
    new ServiceException(
      HttpStatus.BAD_REQUEST,
      'Cập nhật dịch vụ không thành công',
      `Đã xảy ra lỗi trong quá trình cập nhật dịch vụ với id: ${id}.`,
    ),
  DeleteFailed: (id: string) =>
    new ServiceException(
      HttpStatus.BAD_REQUEST,
      'Xóa dịch vụ không thành công',
      `Đã xảy ra lỗi trong quá trình xóa dịch vụ với id: ${id}.`,
    ),
  ActionFailed: (action: string, errorDetail?: string) =>
    new ServiceException(
      HttpStatus.BAD_REQUEST,
      `${action} không thành công`,
      errorDetail || `Đã xảy ra lỗi hệ thống khi ${action.toLowerCase()}.`,
    ),
};
