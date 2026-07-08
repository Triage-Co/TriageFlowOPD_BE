import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { CreateTransactionRequestDto } from './dto/request-transaction.dto';
import { TransactionService } from './transaction.service';


@Controller('transaction')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) { }

  @Post()
  @ApiOperation({
    summary: "Tạo mã qr thanh toán"
  })
  @ApiOkResponse({
    schema: {
      example: {
        "bin": "970422",
        "accountNumber": "VQRQAJSYL9028",
        "accountName": "NGUYEN TRUNG",
        "amount": 2000,
        "description": "Thanh toan",
        "orderCode": 1234956,
        "currency": "VND",
        "paymentLinkId": "af215155d9ee490d85ff848675cff07c",
        "status": "PENDING",
        "expiredAt": null,
        "checkoutUrl": "https://pay.payos.vn/web/af215155d9ee490d85ff848675cff07c",
        "qrCode": "00020101021238570010A000000727012700069704220113VQRQAJSYL90280208QRIBFTTA5303704540420005802VN62140810Thanh toan630419F3"
      }
    }
  })
  @ApiBadRequestResponse({
    schema: {
      example: {
        "code": 500,
        "message": "Tạo link thanh toán không thành công",
        "status": "error",
        "error": {
          "status": 200,
          "headers": {},
          "error": {
            "code": "231",
            "desc": "Đơn thanh toán đã tồn tại"
          },
          "code": "231",
          "desc": "Đơn thanh toán đã tồn tại"
        }
      }
    }
  })
  create(@Body() createTransactionRequestDto: CreateTransactionRequestDto) {
    return this.transactionService.create(createTransactionRequestDto);
  }

  @Post("/webhook")
  @ApiOperation({
    summary: "Webhook khi thanh toán thành công (tự gọi)"
  })
  webhook(@Body() body: any) {
    return this.transactionService.webhook(body);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Lấy thanh toán theo id"
  })
  findOne(@Param("id") id: string) {
    return this.transactionService.findOne(id);
  }

  @Get()
  @ApiOperation({
    summary: "Lấy toàn bộ thanh toán"
  })
  findMany() {
    return this.transactionService.findMany();
  }
}
