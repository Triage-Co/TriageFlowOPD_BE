import { Response } from 'express';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Đã có lỗi hệ thống xảy ra. Vui lòng thử lại sau.';
    let detail =
      exception instanceof Error ? exception.message : String(exception);

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse: any = exception.getResponse();
      message = exceptionResponse?.message || message;
      detail = Array.isArray(exceptionResponse?.message)
        ? exceptionResponse.message[0]
        : exceptionResponse.detail;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': {
          status = HttpStatus.CONFLICT;
          message = 'Lỗi trùng lập dữ liệu';
          const meta = exception.meta as any;

          const index = meta?.driverAdapterError?.cause?.constraint.fields;

          // const target = exception.meta?.target as string[];
          detail = `Dữ liệu đã tồn tại ở các trường: ${index || 'không xác định'}`;
          break;
        }
        case 'P2003': {
          status = HttpStatus.BAD_REQUEST;
          const meta = exception.meta as any;

          const index = meta?.driverAdapterError?.cause?.constraint?.index;

          const field = index?.replace(/^step_/, '').replace(/_fkey$/, '');

          detail = `Không thể tham chiếu dữ liệu ở trường: ${field ?? 'không xác định'}`;

          break;
        }
        case 'P2007': {
          status = HttpStatus.BAD_REQUEST;
          let rawMessage = (exception.meta as any)?.driverAdapterError.cause
            .message as String;

          let match = rawMessage.match(/"([^"]+)"/);

          message = 'Lỗi xác thực dữ liệu ở database';
          detail = match
            ? `Giá trị ${match[1]} không đúng định dạng hoặc không hợp lệ.`
            : 'Một hoặc nhiều giá trị không hợp lệ.';
          break;
        }
        case 'P2025': {
          status = HttpStatus.NOT_FOUND; // 404
          message = 'Không tìm thấy dữ liệu';
          detail =
            String(exception.meta?.cause) ||
            'Bản ghi yêu cầu không tồn tại trong hệ thống';
          break;
        }
        default: {
          status = HttpStatus.BAD_REQUEST;
          message = 'Lỗi truy vấn cơ sở dữ liệu';
          detail = `${exception.message}`;
          break;
        }
      }
    }

    response.status(status).json({
      code: status,
      status: 'error',
      message: Array.isArray(message) ? message[0] : message,
      detail: detail,
    });
  }
}
