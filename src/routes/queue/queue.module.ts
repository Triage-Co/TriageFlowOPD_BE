import { forwardRef, Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { QueuePriorityService } from './queue-priority.service';
import { QueueEtaService } from './queue-eta.service';
import { QueueRebalanceService } from './queue-rebalance.service';
import { QueueAdminController } from './queue-admin.controller';
import { QueueAdminService } from './queue-admin.service';
import { QueueCacheService } from './queue-cache.service';
import { QueueGateway } from '../../shared/gateways/queue.gateway';
import { StepModule } from '../step/step.module';
import { PrescriptionModule } from '../pharmacy/prescription/prescription.module';

@Module({
  imports: [
    forwardRef(() => StepModule),
    forwardRef(() => PrescriptionModule),
  ],
  controllers: [QueueController, QueueAdminController],
  providers: [
    QueueGateway,
    QueueService,
    QueuePriorityService,
    QueueEtaService,
    QueueRebalanceService,
    QueueAdminService,
    QueueCacheService,
  ],
  exports: [
    QueueGateway,
    QueueService,
    QueuePriorityService,
    QueueEtaService,
    QueueRebalanceService,
    QueueAdminService,
    QueueCacheService,
  ],
})
export class QueueModule {}
