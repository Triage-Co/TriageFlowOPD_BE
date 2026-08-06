import { Module } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionController } from './transaction.controller';
import { QueueModule } from '../queue/queue.module';
import { StepModule } from '../step/step.module';
import { FlowModule } from '../flow/flow.module';

@Module({
  imports: [QueueModule, StepModule, FlowModule],
  controllers: [TransactionController],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class TransactionModule {}
