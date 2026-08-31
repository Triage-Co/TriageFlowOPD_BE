import { Module, forwardRef } from '@nestjs/common';
import { PrescriptionService } from './prescription.service';
import { PrescriptionController } from './prescription.controller';
import { QueueModule } from '../../queue/queue.module';
import { DisplayScreenModule } from '../../display-screen/display-screen.module';

@Module({
  imports: [forwardRef(() => QueueModule), DisplayScreenModule],
  controllers: [PrescriptionController],
  providers: [PrescriptionService],
  exports: [PrescriptionService],
})
export class PrescriptionModule {}
