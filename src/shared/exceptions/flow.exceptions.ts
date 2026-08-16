import { HttpException, HttpStatus } from '@nestjs/common';

export class FlowExceptions extends HttpException {
  constructor(status: HttpStatus, message: string, detail: string) {
    super({ message, detail }, status);
  }
}
export const FlowErrors = {
  FlowInProgress: (patientId: string, flowId: string) =>
    new FlowExceptions(
      HttpStatus.BAD_REQUEST,
      'Bạn đang có một lịch khám chưa hoàn tất. Vui lòng hoàn thành quy trình khám hiện tại trước khi đặt lịch mới',
      `Bệnh nhân ${patientId} đang có lịch khám với flow ${flowId} ở trạng thái chưa hoàn thành.`,
    ),
  NotFoundById: (id: string) => {
    return new FlowExceptions(
      HttpStatus.NOT_FOUND,
      'Không tìm thấy thông tin lịch khám',
      `Hệ thống chưa ghi nhận lịch khám có mã số ${id}. Quý khách vui lòng kiểm tra lại`,
    );
  },
  NotFound: () => {
    return new FlowExceptions(
      HttpStatus.NOT_FOUND,
      'Không tìm thấy thông tin lịch khám',
      `Hệ thống chưa ghi nhận lịch khám. Quý khách vui lòng kiểm tra lại`,
    );
  },
  ProviderError: (action: string, detail: string) =>
    new FlowExceptions(HttpStatus.BAD_REQUEST, `Lỗi ${action}`, detail),
};
