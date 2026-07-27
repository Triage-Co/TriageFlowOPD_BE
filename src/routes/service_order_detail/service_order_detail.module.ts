import { Module } from '@nestjs/common';
import { ServiceOrderDetailService } from './service_order_detail.service';
import { ServiceOrderDetailController } from './service_order_detail.controller';

@Module({
  controllers: [ServiceOrderDetailController],
  providers: [ServiceOrderDetailService],
})
export class ServiceOrderDetailModule {}
