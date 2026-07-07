import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/payment.dto';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @ApiOperation({
    summary: 'Tạo mã qr thanh toán',
  })
  @ApiOkResponse({
    schema: {
      example: {
        bin: '970422',
        accountNumber: 'VQRQAJSYL9028',
        accountName: 'NGUYEN TRUNG',
        amount: 2000,
        description: 'Thanh toan',
        orderCode: 1234956,
        currency: 'VND',
        paymentLinkId: 'af215155d9ee490d85ff848675cff07c',
        status: 'PENDING',
        expiredAt: null,
        checkoutUrl:
          'https://pay.payos.vn/web/af215155d9ee490d85ff848675cff07c',
        qrCode:
          '00020101021238570010A000000727012700069704220113VQRQAJSYL90280208QRIBFTTA5303704540420005802VN62140810Thanh toan630419F3',
      },
    },
  })
  @ApiBadRequestResponse({
    schema: {
      example: {
        code: 500,
        message: 'Tạo link thanh toán không thành công',
        status: 'error',
        error: {
          status: 200,
          headers: {},
          error: {
            code: '231',
            desc: 'Đơn thanh toán đã tồn tại',
          },
          code: '231',
          desc: 'Đơn thanh toán đã tồn tại',
        },
      },
    },
  })
  create(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentService.create(createPaymentDto);
  }

  @Post('/webhook')
  @ApiOperation({
    summary: 'Webhook khi thanh toán thành công (tự gọi)',
  })
  webhook(@Body() body: any) {
    return this.paymentService.webhook(body);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Lấy thanh toán theo id',
  })
  findOne(@Param('id') id: string) {
    return this.paymentService.findOne(id);
  }

  @Get()
  @ApiOperation({
    summary: 'Lấy toàn bộ thanh toán',
  })
  findMany() {
    return this.paymentService.findMany();
  }
}
