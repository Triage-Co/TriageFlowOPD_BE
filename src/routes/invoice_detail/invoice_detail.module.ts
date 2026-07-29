import { Module } from '@nestjs/common';
import { InvoiceDetailService } from './invoice_detail.service';
import { InvoiceDetailController } from './invoice_detail.controller';

@Module({
  controllers: [InvoiceDetailController],
  providers: [InvoiceDetailService],
})
export class InvoiceDetailModule {}
