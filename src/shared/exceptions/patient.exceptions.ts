import { HttpException, HttpStatus } from '@nestjs/common';

export class PatientExceptions extends HttpException {
  constructor(status: HttpStatus, message: string, detail: string) {
    super({ message, detail }, status);
  }
}
export const PatientErrors = {
  PatientNotFoundById: (patientId: string) =>
    new PatientExceptions(
      HttpStatus.NOT_FOUND,
      'Không tìm thấy hồ sơ bệnh nhân. Vui lòng kiểm tra lại',
      `Không tìm thấy bệnh nhân với id: ${patientId}`,
    ),
  ProviderError: (action: string, detail: string) =>
    new PatientExceptions(HttpStatus.BAD_REQUEST, `Lỗi ${action}`, detail),
};
