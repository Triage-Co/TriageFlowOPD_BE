import { PartialType } from '@nestjs/swagger';
import { CreateInvoiceDetailDto } from './create-invoice_detail.dto';

export class UpdateInvoiceDetailDto extends PartialType(CreateInvoiceDetailDto) {}
