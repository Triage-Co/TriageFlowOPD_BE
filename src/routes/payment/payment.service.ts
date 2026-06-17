import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CreatePaymentDto } from './dto/payment.dto';
import { PayosConfig } from '../../shared/config/payos.config';
import { PrismaConfig } from '../../shared/config/prisma.config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomInt } from 'crypto';

@Injectable()
export class PaymentService {

  private readonly logger = new Logger(PaymentService.name);

  constructor(private readonly payosClient: PayosConfig, private readonly prismaClient: PrismaConfig) { }

  async create(createPaymentDto: CreatePaymentDto) {
    try {
      const data = await this.prismaClient.users.findUnique({
        where: {
          id: createPaymentDto.clientId
        }
      })

      if (!data) {
        return {
          code: 404,
          message: `không tìm thấy user với id ${createPaymentDto.clientId}`,
          status: "error"
        }
      }

      const orderCode = parseInt(
        `${Date.now().toString().slice(-3)}${randomInt(10, 999)}`
      );

      const paymentLink = await this.payosClient.getClient().paymentRequests.create({
        orderCode: orderCode,
        amount: createPaymentDto.amount,
        description: "Thanh toán",
        returnUrl: createPaymentDto.returnUrl,
        cancelUrl: createPaymentDto.cancelUrl,
      })

      await this.prismaClient.transaction.create({
        data: {
          buyerId: data.id,
          docNo: paymentLink.orderCode,
          transType: createPaymentDto.transType,
          amount: paymentLink.amount,
        }
      })

      return paymentLink;
    } catch (error) {
      return {
        code: 500,
        message: "Tạo link thanh toán không thành công",
        status: "error",
        error: error
      }
    }
  }

  async webhook(payload: any) {
    try {
      console.log("payload_1", payload);
      console.log("payload data_2", payload.data);
      const paymentData = payload.data;
      await this.prismaClient.transaction.update({
        where: {
          docNo: paymentData.orderCode
        },
        data: {
          status: "SUCCESSED"
        }
      })
    } catch (error) {
      return {
        code: 500,
        message: "Cập nhật trạng thái thanh toán không thành công",
        status: "error",
        error: error
      }
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredTransactions() {
    try {
      const expirationTime = new Date();
      expirationTime.setMinutes(expirationTime.getMinutes() - 15);
      await this.prismaClient.transaction.updateMany({
        where: {
          status: "PENDING",
          transDate: {
            lte: expirationTime
          }
        },
        data: {
          status: "CANCELLED"
        }
      })
    } catch (error) {
      this.logger.error("Lỗi khi chạy cron job hủy giao dịch:", error)
    }
  }

  async findOne(id: string) {
    try {
      const data = await this.prismaClient.transaction.findFirst(
        {
          where: {
            id: id
          }
        }
      )

      if (!data) {
        throw new BadRequestException("Không tìm thấy giao dịch")
      }

      return {
        code: 200,
        message: "Lấy danh sách thanh toán theo id thành công",
        status: "success",
        data: data
      }
    } catch (error) {
      return {
        code: 500,
        message: error instanceof Error ? error.message : "Unknown error",
        status: "error"
      }
    }
  }

  async findMany() {
    try {
      const data = await this.prismaClient.transaction.findMany()

      if (!data) {
        throw new BadRequestException("Không tìm thấy giao dịch")
      }

      return {
        code: 200,
        message: "Lấy danh sách thanh toán thành công",
        status: "success",
        data: data
      }
    } catch (error) {
      return {
        code: 500,
        message: error instanceof Error ? error.message : "Unknown error",
        status: "error"
      }
    }
  }
}
