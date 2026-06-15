import { Injectable } from '@nestjs/common';
import { CreatePaymentDto } from './dto/payment.dto';
import { PayosConfig } from '../../shared/config/payos.config';
import { PrismaConfig } from '../../shared/config/prisma.config';

@Injectable()
export class PaymentService {
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

      const paymentLink = await this.payosClient.getClient().paymentRequests.create({
        orderCode: createPaymentDto.orderCode,
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
          status: "SUCCESS"
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
}
