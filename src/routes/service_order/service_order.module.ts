import { Module } from '@nestjs/common';
import { ServiceOrderService } from './service_order.service';
import { ServiceOrderController } from './service_order.controller';

@Module({
  controllers: [ServiceOrderController],
  providers: [ServiceOrderService],
})
export class ServiceOrderModule {}
