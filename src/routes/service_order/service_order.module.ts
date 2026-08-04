import { forwardRef, Module } from '@nestjs/common';
import { ServiceOrderService } from './service_order.service';
import { ServiceOrderController } from './service_order.controller';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [forwardRef(() => QueueModule)],
  controllers: [ServiceOrderController],
  providers: [ServiceOrderService],
})
export class ServiceOrderModule {}
