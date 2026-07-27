import { HttpException, HttpStatus } from '@nestjs/common';


export class ServiceOrderDetailException extends HttpException {
  constructor(
    status: HttpStatus,
    message: string,
    detail: string,
  ) {
    super(
      {
        message,
        detail,
      },
      status,
    );
  }
}


export const ServiceOrderDetailErrors = {

  ServiceOrderDetailNotFoundById: (id: string) =>
    new ServiceOrderDetailException(
      HttpStatus.NOT_FOUND,
      'Không tìm thấy chi tiết Service Order',
      `Không tìm thấy Service Order Detail với id: ${id}.`,
    ),


  ServiceOrderNotFound: (id: string) =>
    new ServiceOrderDetailException(
      HttpStatus.NOT_FOUND,
      'Không tìm thấy Service Order',
      `Không tìm thấy Service Order với id: ${id}.`,
    ),


  ServiceNotFound: (id: string) =>
    new ServiceOrderDetailException(
      HttpStatus.NOT_FOUND,
      'Không tìm thấy dịch vụ',
      `Không tìm thấy Service với id: ${id}.`,
    ),


  ActionFailed: (
    action: string,
    errorDetail?: string,
  ) =>
    new ServiceOrderDetailException(
      HttpStatus.BAD_REQUEST,
      `${action} không thành công`,
      errorDetail ??
        `Đã xảy ra lỗi khi ${action.toLowerCase()}.`,
    ),
};
