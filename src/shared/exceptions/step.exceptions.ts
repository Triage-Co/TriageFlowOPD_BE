import { HttpException, HttpStatus } from '@nestjs/common';

export class StepException extends HttpException {
  constructor(status: HttpStatus, message: string, detail: string) {
    super({ message, detail }, status);
  }
}

export const StepErrors = {
  StepListNotFound: () => {
    throw new StepException(
      HttpStatus.NOT_FOUND,
      'Không tìm thấy dữ liệu',
      'Không tìm thấy bước nào trong hệ thống.',
    );
  },
  StepListNotFoundByAccountId: (account_id: string) => {
    throw new StepException(
      HttpStatus.NOT_FOUND,
      'Không tìm thấy dữ liệu',
      `Không tìm thấy bước nào trong hệ thống của người dùng: ${account_id}.`,
    );
  },
  StepNotFoundByIdAndAccountId: (account_id: string, step_id: string) => {
    throw new StepException(
      HttpStatus.NOT_FOUND,
      'Không tìm thấy dữ liệu',
      `Không tìm thấy bước với id: ${step_id} nào trong hệ thống của người dùng: ${account_id}.`,
    );
  },
  StepNotFoundByIdAndPatientId: (patientId: string, stepId: string) => {
    throw new StepException(
      HttpStatus.NOT_FOUND,
      'Không tìm thấy dữ liệu',
      `Không tìm thấy bước với id: ${stepId} nào trong hệ thống của bệnh nhân: ${patientId}.`,
    );
  },
  StepNotFoundById: (step_id: string) => {
    throw new StepException(
      HttpStatus.NOT_FOUND,
      'Không tìm thấy dữ liệu',
      `Không tìm thấy step với id: ${step_id} nào trong hệ thống.`,
    );
  },
  ProviderError: (action: string, detail: string) =>
    new StepException(HttpStatus.BAD_REQUEST, `Lỗi ${action}`, detail),
};
