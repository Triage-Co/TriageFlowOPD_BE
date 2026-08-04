import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { QueuePriorityService } from './queue-priority.service';
import { QueueEtaService } from './queue-eta.service';

@Module({
  controllers: [QueueController],
  providers: [QueueService, QueuePriorityService, QueueEtaService],
  exports: [QueueService, QueuePriorityService, QueueEtaService],
})
export class QueueModule {}
