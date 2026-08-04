import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { QueuePriorityService } from './queue-priority.service';
import { QueueEtaService } from './queue-eta.service';
import { QueueRebalanceService } from './queue-rebalance.service';
import { QueueAdminController } from './queue-admin.controller';
import { QueueAdminService } from './queue-admin.service';

@Module({
  controllers: [QueueController, QueueAdminController],
  providers: [
    QueueService,
    QueuePriorityService,
    QueueEtaService,
    QueueRebalanceService,
    QueueAdminService,
  ],
  exports: [
    QueueService,
    QueuePriorityService,
    QueueEtaService,
    QueueRebalanceService,
    QueueAdminService,
  ],
})
export class QueueModule {}
