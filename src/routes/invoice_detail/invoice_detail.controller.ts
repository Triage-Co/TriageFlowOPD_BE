import { Controller, Get, Param, Delete } from '@nestjs/common';
import { InvoiceDetailService } from './invoice_detail.service';

@Controller('invoice-detail')
export class InvoiceDetailController {
  constructor(private readonly invoiceDetailService: InvoiceDetailService) {}

  @Get()
  findAll() {
    return this.invoiceDetailService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.invoiceDetailService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.invoiceDetailService.remove(id);
  }
}
