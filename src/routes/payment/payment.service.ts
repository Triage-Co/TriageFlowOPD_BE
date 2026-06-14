import { Injectable } from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PayosConfig } from '../../shared/config/payos.config';
import { Prisma } from '@prisma/client';
import { PrismaConfig } from '../../shared/config/prisma.config';

@Injectable()
export class PaymentService {
  constructor(private readonly payosClient: PayosConfig, private readonly prismaClient: PrismaConfig) { }

  async create(createPaymentDto: CreatePaymentDto) {
    // const data = await this.prismaClient.users.findUnique({
    //   where: {
    //     id: createPaymentDto.clientId
    //   }
    // })

    // if (!data) {
    //   return {
    //     code: 404,
    //     message: `không tìm thấy user với id ${createPaymentDto.clientId}`,
    //     status: "error"
    //   }
    // }
    const paymentLink = await this.payosClient.getClient().paymentRequests.create({
      orderCode: createPaymentDto.orderCode,
      amount: createPaymentDto.amount,
      description: "mua hang",
      returnUrl: createPaymentDto.returnUrl,
      cancelUrl: createPaymentDto.cancelUrl,
      // buyerName: data.full_name
    })
    return paymentLink;
  }
}
