import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { QueuePriorityService } from './queue-priority.service';
import { QueueEtaService } from './queue-eta.service';
import { QueueRebalanceService } from './queue-rebalance.service';

@Module({
  controllers: [QueueController],
  providers: [QueueService, QueuePriorityService, QueueEtaService, QueueRebalanceService],
  exports: [QueueService, QueuePriorityService, QueueEtaService, QueueRebalanceService],
})
export class QueueModule {}
