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
      'Không tìm thấy yêu cầu dịch vụ',
      `Hệ thống chưa ghi nhận phiếu yêu cầu dịch vụ có mã số ${id}. Quý khách vui lòng kiểm tra lại mã số hoặc liên hệ nhân viên y tế để được hỗ trợ.`,
    ),

  CreateFailed: () =>
    new ServiceOrderException(
      HttpStatus.BAD_REQUEST,
      'Khởi tạo yêu cầu dịch vụ không thành công',
      'Hệ thống tạm thời bị gián đoạn, không thể tạo phiếu yêu cầu dịch vụ mới. Quý khách vui lòng thử lại sau ít phút.',
    ),

  UpdateFailed: (id: string) =>
    new ServiceOrderException(
      HttpStatus.BAD_REQUEST,
      'Cập nhật thông tin dịch vụ không thành công',
      `Không thể cập nhật thông tin cho phiếu yêu cầu dịch vụ (Mã số: ${id}) vào lúc này. Vui lòng kiểm tra lại trạng thái phiếu và thử lại`,
    ),

  DeleteFailed: (id: string) =>
    new ServiceOrderException(
      HttpStatus.BAD_REQUEST,
      'Hủy yêu cầu dịch vụ không thành công',
      `Hệ thống không thể hủy phiếu yêu cầu dịch vụ (Mã số: ${id}). Quý khách vui lòng đảm bảo dịch vụ này chưa được thực hiện hoặc thử lại`,
    ),

  NotEmpty: () =>
    new ServiceOrderException(
      HttpStatus.BAD_REQUEST,
      'Thiếu thông tin yêu cầu dịch vụ',
      'Danh sách các dịch vụ không được để trống. Quý khách vui lòng chọn ít nhất một dịch vụ lâm sàng hoặc cận lâm sàng để tiếp tục.',
    ),

  ActionFailed: (action: string, detail?: string) =>
    new ServiceOrderException(
      HttpStatus.BAD_REQUEST,
      `Không thể hoàn tất yêu cầu: ${action}`,
      detail ??
        `Quá trình xử lý tác vụ "${action.toLowerCase()}" đang bị gián đoạn. Quý khách vui lòng thử lại sau ít phút`,
    ),
};
