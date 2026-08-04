import { Module } from '@nestjs/common';
import { ServiceOrderService } from './service_order.service';
import { ServiceOrderController } from './service_order.controller';
import { TransactionModule } from '../transaction/transaction.module';

@Module({
  imports: [TransactionModule],
  controllers: [ServiceOrderController],
  providers: [ServiceOrderService],
})
export class ServiceOrderModule {}
