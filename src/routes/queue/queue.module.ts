import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { QueuePriorityService } from './queue-priority.service';

@Module({
  controllers: [QueueController],
  providers: [QueueService, QueuePriorityService],
  exports: [QueueService, QueuePriorityService],
})
export class QueueModule {}
