import { HttpException, HttpStatus } from '@nestjs/common';

export class SpecialtyException extends HttpException {
  constructor(status: HttpStatus, message: string, detail: string) {
    super({ message, detail }, status);
  }
}

export const SpecialtyErrors = {
  SpecialtyNotFound: new SpecialtyException(
    HttpStatus.NOT_FOUND,
    'Không tìm được chuyên khoa',
    'Không tìm được chuyên khoa trong hệ thống.',
  ),
  SpecialtyNotFoundByCode: (code: string) =>
    new SpecialtyException(
      HttpStatus.NOT_FOUND,
      'Không tìm được chuyên khoa',
      `Không tìm được chuyên khoa với code: ${code} trong hệ thống.`,
    ),
  SpecialtyNotFoundById: (id: string) =>
    new SpecialtyException(
      HttpStatus.NOT_FOUND,
      'Không tìm được chuyên khoa',
      `Không tìm được chuyên khoa với id: ${id} trong hệ thống.`,
    ),
  ProviderError: (action: string, detail: string) =>
    new SpecialtyException(HttpStatus.BAD_REQUEST, `Lỗi ${action}`, detail),
};
