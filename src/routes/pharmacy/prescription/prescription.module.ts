import { Module, forwardRef } from '@nestjs/common';
import { PrescriptionService } from './prescription.service';
import { PrescriptionController } from './prescription.controller';
import { QueueModule } from '../../queue/queue.module';

@Module({
  imports: [forwardRef(() => QueueModule)],
  controllers: [PrescriptionController],
  providers: [PrescriptionService],
  exports: [PrescriptionService],
})
export class PrescriptionModule {}
