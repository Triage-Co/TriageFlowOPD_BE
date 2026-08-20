import { forwardRef, Module } from '@nestjs/common';
import { ServiceOrderService } from './service_order.service';
import { ServiceOrderController } from './service_order.controller';
import { QueueModule } from '../queue/queue.module';
import { TransactionModule } from '../transaction/transaction.module';
import { StepModule } from '../step/step.module';

@Module({
  imports: [
    forwardRef(() => QueueModule),
    forwardRef(() => StepModule),
    TransactionModule,
  ],
  controllers: [ServiceOrderController],
  providers: [ServiceOrderService],
})
export class ServiceOrderModule {}
