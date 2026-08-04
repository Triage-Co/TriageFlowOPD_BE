import { forwardRef, Module } from '@nestjs/common';
import { StepService } from './step.service';
import { StepController } from './step.controller';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [forwardRef(() => QueueModule)],
  controllers: [StepController],
  providers: [StepService],
  exports: [StepService],
})
export class StepModule {}
