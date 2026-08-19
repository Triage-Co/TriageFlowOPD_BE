import { Module, forwardRef } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionController } from './transaction.controller';
import { QueueModule } from '../queue/queue.module';
import { StepModule } from '../step/step.module';
import { FlowModule } from '../flow/flow.module';
import { PrescriptionModule } from '../pharmacy/prescription/prescription.module';

@Module({
  imports: [
    QueueModule,
    StepModule,
    FlowModule,
    forwardRef(() => PrescriptionModule),
  ],
  controllers: [TransactionController],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class TransactionModule {}
