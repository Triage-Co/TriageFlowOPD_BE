import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  forwardRef,
} from '@nestjs/common';
// import { Cron, CronExpression } from '@nestjs/schedule';
import { randomInt } from 'crypto';
import { PayosService } from '../../shared/config/payos.service';
import { PrismaService } from '../../shared/config/prisma.service';
import {
  CreateTransactionRequestDto,
  PayCashDto,
} from './dto/request-transaction.dto';
import { QueueService } from '../queue/queue.service';
import { PayOS } from '@payos/node';
import { PrismaClient } from '@prisma/client';
import { ResponseType } from '../../shared/types/response.type';
import type { IStepRepository } from '../../shared/interfaces/i-step.repository';
import { StepService } from '../step/step.service';
import { FlowService } from '../flow/flow.service';
import { PrescriptionService } from '../pharmacy/prescription/prescription.service';

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
    private readonly queueService: QueueService,
    @Inject('IStepRepository')
    private readonly stepRepository: IStepRepository,
    private readonly stepService: StepService,
    private readonly flowService: FlowService,
    @Inject(forwardRef(() => PrescriptionService))
    private readonly prescriptionService: PrescriptionService,
  ) {
    this.payosClient = this.payosService.getClient();
    this.TRANSACTION = this.prismaService.transaction;
    this.ACCOUNT = this.prismaService.account;
    this.STEP = this.prismaService.step;
  }

  async create(
    createTransactionRequestDto: CreateTransactionRequestDto,
    tx?: any,
  ): Promise<ResponseType<any>> {
    try {
      const db = tx || this.prismaService;
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

      await db.transaction.create({
        data: {
          buyerId: createTransactionRequestDto.clientId,
          docNo: paymentLink.orderCode,
          transType: createTransactionRequestDto.transType,
          amount: paymentLink.amount,
          service_order_id: createTransactionRequestDto.service_order_id,
        },
      });

      return {
        code: 200,
        message: 'Lấy lin thanh toán thành công',
        status: 'success',
        data: paymentLink,
      };
    } catch (error) {
      console.error('Transaction Create Error:', error);
      return {
        code: 500,
        message: 'Tạo link thanh toán không thành công',
        status: 'error',
        detail: error,
      };
    }
  }

  async payCash(dto: PayCashDto): Promise<ResponseType<any>> {
    try {
      const isPrescription = await this.prismaService.prescription.findUnique({
        where: { service_order_id: dto.service_order_id },
      });

      if (isPrescription) {
        throw new BadRequestException(
          'Vui lòng sang quầy Dược để thanh toán đơn thuốc.',
        );
      }

      const invoice = await this.prismaService.invoice.findFirst({
        where: { service_order_id: dto.service_order_id },
      });

      if (!invoice) {
        throw new BadRequestException(
          'Không tìm thấy hóa đơn cho đơn dịch vụ này',
        );
      }

      const orderCode = parseInt(
        `${Date.now().toString().slice(-3)}${randomInt(10, 999)}`,
      );

      const serviceOrder = await this.prismaService.service_Order.findUnique({
        where: { service_order_id: dto.service_order_id },
        include: { booking: true },
      });

      const transaction = await this.TRANSACTION.create({
        data: {
          buyerId: serviceOrder?.booking?.patient_id || '',
          docNo: orderCode,
          transType: 'ORDER_PAYMENT',
          amount: invoice.total_amount,
          service_order_id: dto.service_order_id,
          status: 'SUCCESSED',
        },
      });

      await this.prismaService.service_Order.update({
        where: { service_order_id: dto.service_order_id },
        data: { payment_status: 'SUCCESSED' },
      });

      await this.prismaService.service_Order_Detail.updateMany({
        where: { service_order_id: dto.service_order_id },
        data: { status: 'PAID' },
      });

      const createdFlowResult =
        await this.flowService.createFlowFromServiceOrder(dto.service_order_id);

      if (createdFlowResult === null) {
        const paymentSteps = await this.STEP.findMany({
          where: {
            service_order_id: dto.service_order_id,
            step_type: 'PAYMENT',
          },
        });

        for (const step of paymentSteps) {
          if (step.step_status === 'PENDING') {
            await this.STEP.update({
              where: { step_id: step.step_id },
              data: { step_status: 'IN_PROGRESS' },
            });
          }

          await this.stepService.completeStep(step.step_id);

          if (step.flow_id) {
            await this.prismaService.flow.updateMany({
              where: { flow_id: step.flow_id, status: 'PENDING' },
              data: { status: 'IN_PROGRESS' },
            });
          }
        }
      }

      await this.prismaService.invoice.updateMany({
        where: { service_order_id: dto.service_order_id },
        data: {
          status: 'PAID',
          payment_date: new Date(),
          payment_method: 'CASH',
        },
      });

      await this.queueService.generateServiceQueueNumber(dto.service_order_id);

      if (createdFlowResult !== null) {
        return {
          code: 200,
          message: 'Thanh toán gói khám thành công, Flow đã được tạo',
          status: 'success',
          data: { transaction, flow: createdFlowResult },
        };
      }

      return {
        code: 200,
        message: 'Thanh toán tiền mặt thành công',
        status: 'success',
        data: transaction,
      };
    } catch (error) {
      this.logger.error('Cash payment error:', error);
      return {
        code: 500,
        message: 'Thanh toán tiền mặt không thành công',
        status: 'error',
        detail: error,
      };
    }
  }

  async webhook(payload: any) {
    try {
      const paymentData = payload.data;
      const transaction = await this.TRANSACTION.update({
        where: {
          docNo: paymentData.orderCode,
        },
        data: {
          status: 'SUCCESSED',
        },
      });

      if (transaction && transaction.service_order_id) {
        await this.prismaService.service_Order.update({
          where: { service_order_id: transaction.service_order_id },
          data: { payment_status: 'SUCCESSED' },
        });

        await this.prismaService.prescription.updateMany({
          where: {
            service_order_id: transaction.service_order_id,
            status: 'PENDING',
          },
          data: { status: 'PROCESSING' },
        });

        await this.prescriptionService.assignPickupNumbersByServiceOrder(
          transaction.service_order_id,
        );

        await this.prismaService.service_Order_Detail.updateMany({
          where: { service_order_id: transaction.service_order_id },
          data: { status: 'PAID' },
        });

        const createdFlowResult =
          await this.flowService.createFlowFromServiceOrder(
            transaction.service_order_id,
          );

        if (createdFlowResult === null) {
          const paymentSteps = await this.STEP.findMany({
            where: {
              service_order_id: transaction.service_order_id,
              step_type: 'PAYMENT',
            },
          });

          for (const step of paymentSteps) {
            if (step.step_status === 'PENDING') {
              await this.STEP.update({
                where: { step_id: step.step_id },
                data: { step_status: 'IN_PROGRESS' },
              });
            }
            await this.stepService.completeStep(step.step_id);

            if (step.flow_id) {
              await this.prismaService.flow.updateMany({
                where: {
                  flow_id: step.flow_id,
                  status: 'PENDING',
                },
                data: { status: 'IN_PROGRESS' },
              });
            }
          }
        }

        await this.prismaService.invoice.updateMany({
          where: { service_order_id: transaction.service_order_id },
          data: {
            status: 'PAID',
            payment_date: new Date(),
          },
        });

        await this.queueService.generateServiceQueueNumber(
          transaction.service_order_id,
        );
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
