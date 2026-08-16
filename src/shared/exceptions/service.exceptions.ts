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
      'Mã dịch vụ đã tồn tại',
      `Mã dịch vụ y tế ${code} đã được ghi nhận trên hệ thống. Quý lòng sử dụng mã khác hoặc kiểm tra lại danh mục dịch vụ.`,
    ),

  ServiceNotFoundById: (id: string) =>
    new ServiceException(
      HttpStatus.NOT_FOUND,
      'Không tìm thấy thông tin dịch vụ',
      `Hệ thống chưa ghi nhận dịch vụ có mã số định danh ${id}. Quý khách vui lòng kiểm tra lại thông tin.`,
    ),

  ServiceNotFoundByCode: (code: string) =>
    new ServiceException(
      HttpStatus.NOT_FOUND,
      'Không tìm thấy thông tin dịch vụ',
      `Hệ thống chưa ghi nhận dịch vụ y tế có mã ${code}. Quý khách vui lòng kiểm tra lại`,
    ),

  CreateFailed: () =>
    new ServiceException(
      HttpStatus.BAD_REQUEST,
      'Thêm mới dịch vụ không thành công',
      'Hệ thống tạm thời bị gián đoạn, không thể thiết lập dịch vụ y tế mới lúc này. Quý khách vui lòng thử lại sau ít phút',
    ),

  UpdateFailed: (id: string) =>
    new ServiceException(
      HttpStatus.BAD_REQUEST,
      'Cập nhật thông tin dịch vụ không thành công',
      `Không thể cập nhật thông tin cho dịch vụ (Mã số: ${id}) vào lúc này. Quý khách vui lòng thử lại sau`,
    ),

  DeleteFailed: (id: string) =>
    new ServiceException(
      HttpStatus.BAD_REQUEST,
      'Hủy dịch vụ không thành công',
      `Hệ thống không thể hủy dịch vụ y tế (Mã số: ${id}). Vui lòng đảm bảo dịch vụ này chưa được chỉ định trong các hồ sơ bệnh án hoặc thử lại`,
    ),
  ServicesNotFound: () =>
    new ServiceException(
      HttpStatus.NOT_FOUND,
      'Không tìm thấy thông tin dịch vụ y tế',
      'Hệ thống chưa ghi nhận một số dịch vụ trong danh sách yêu cầu. Quý khách vui lòng kiểm tra lại mã dịch vụ hoặc liên hệ nhân viên hỗ trợ.',
    ),
  ActionFailed: (action: string, errorDetail?: string) =>
    new ServiceException(
      HttpStatus.BAD_REQUEST,
      `Không thể hoàn tất yêu cầu: ${action}`,
      errorDetail ||
        `Quá trình xử lý tác vụ "${action.toLowerCase()}" đang bị gián đoạn. Quý khách vui lòng thử lại sau ít phút.`,
    ),
};
