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
  ProviderError: (action: string, detail: string) =>
    new FlowExceptions(HttpStatus.BAD_REQUEST, `Lỗi ${action}`, detail),
};
