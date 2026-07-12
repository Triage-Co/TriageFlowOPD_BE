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
  StepListNotFoundByIdAndAccountId: (account_id: string, step_id: string) => {
    throw new StepException(
      HttpStatus.NOT_FOUND,
      'Không tìm thấy dữ liệu',
      `Không tìm thấy bước với id: ${step_id} nào trong hệ thống của người dùng: ${account_id}.`,
    );
  },
  ProviderError: (action: string, detail: string) =>
    new StepException(HttpStatus.BAD_REQUEST, `Lỗi ${action}`, detail),
};
