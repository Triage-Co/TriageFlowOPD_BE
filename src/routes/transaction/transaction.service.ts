import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
// import { Cron, CronExpression } from '@nestjs/schedule';
import { randomInt } from 'crypto';
import { PayosService } from '../../shared/config/payos.service';
import { PrismaService } from '../../shared/config/prisma.service';
import { CreateTransactionRequestDto } from './dto/request-transaction.dto';
import { PayOS } from '@payos/node';
import { PrismaClient } from '@prisma/client';
import { ResponseType } from '../../shared/types/response.type';
import type { IStepRepository } from '../../shared/interfaces/i-step.repository';

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  private payosClient: PayOS;
  private TRANSACTION: PrismaClient['transaction'];
  private ACCOUNT: PrismaClient['account'];
  private STEP: PrismaClient['step'];
  constructor(
    private readonly payosService: PayosService,
    private readonly prismaService: PrismaService,
    @Inject('IStepRepository')
    private readonly stepRepository: IStepRepository,
  ) {
    this.payosClient = this.payosService.getClient();
    this.TRANSACTION = this.prismaService.transaction;
    this.ACCOUNT = this.prismaService.account;
    this.STEP = this.prismaService.step;
  }

  async create(
    createTransactionRequestDto: CreateTransactionRequestDto,
  ): Promise<ResponseType<any>> {
    try {
      const data = await this.ACCOUNT.findUnique({
        where: {
          account_id: createTransactionRequestDto.clientId,
        },
      });

      if (!data) {
        return {
          code: 404,
          message: `không tìm thấy user với id ${createTransactionRequestDto.clientId}`,
          status: 'error',
        };
      }

      const orderCode = parseInt(
        `${Date.now().toString().slice(-3)}${randomInt(10, 999)}`,
      );

      const paymentLink = await this.payosClient.paymentRequests.create({
        orderCode: orderCode,
        amount: createTransactionRequestDto.amount,
        description: 'Thanh toán',
        returnUrl: createTransactionRequestDto.returnUrl,
        cancelUrl: createTransactionRequestDto.cancelUrl,
      });

      await this.TRANSACTION.create({
        data: {
          buyerId: data.account_id,
          docNo: paymentLink.orderCode,
          transType: createTransactionRequestDto.transType,
          amount: paymentLink.amount,
        },
      });

      return {
        code: 200,
        message: 'Lấy lin thanh toán thành công',
        status: 'success',
        data: paymentLink,
      };
    } catch (error) {
      return {
        code: 500,
        message: 'Tạo link thanh toán không thành công',
        status: 'error',
        detail: error,
      };
    }
  }

  async webhook(payload: any) {
    try {
      const paymentData = payload.data;
      await this.TRANSACTION.update({
        where: {
          docNo: paymentData.orderCode,
        },
        data: {
          status: 'SUCCESSED',
        },
      });

      console.log('paymentData', paymentData);
      console.log('orderCode', paymentData.orderCode);

      const findStepData = await this.STEP.findFirst({
        where: {
          docNo: paymentData.orderCode,
        },
      });

      console.log('step', findStepData);

      if (findStepData) {
        await this.STEP.update({
          where: {
            step_id: findStepData.step_id,
          },
          data: {
            payment_status: 'SUCCESSED',
          },
        });
      }

      return {
        code: 200,
        message: 'Xử lý webhook thành công',
        status: 'success',
      };
    } catch (error) {
      return {
        code: 500,
        message: 'Cập nhật trạng thái thanh toán không thành công',
        status: 'error',
        error: error,
      };
    }
  }


  // @Cron(CronExpression.EVERY_MINUTE)
  // async handleExpiredTransactions() {
  //   try {
  //     const expirationTime = new Date();
  //     expirationTime.setMinutes(expirationTime.getMinutes() - 15);
  //     await this.TRANSACTION.updateMany({
  //       where: {
  //         status: 'PENDING',
  //         transDate: {
  //           lte: expirationTime,
  //         },
  //       },
  //       data: {
  //         status: 'CANCELLED',
  //       },
  //     });
  //   } catch (error) {
  //     this.logger.error('Lỗi khi chạy cron job hủy giao dịch:', error);
  //   }
  // }

  async findOne(id: string) {
    try {
      const data = await this.TRANSACTION.findFirst({
        where: {
          id: id,
        },
      });

      if (!data) {
        throw new BadRequestException('Không tìm thấy giao dịch');
      }

      return {
        code: 200,
        message: 'Lấy danh sách thanh toán theo id thành công',
        status: 'success',
        data: data,
      };
    } catch (error) {
      return {
        code: 500,
        message: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
      };
    }
  }

  async findMany() {
    try {
      const data = await this.TRANSACTION.findMany();

      if (!data) {
        throw new BadRequestException('Không tìm thấy giao dịch');
      }

      return {
        code: 200,
        message: 'Lấy danh sách thanh toán thành công',
        status: 'success',
        data: data,
      };
    } catch (error) {
      return {
        code: 500,
        message: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
      };
    }
  }
}
