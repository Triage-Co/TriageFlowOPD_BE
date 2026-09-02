import { Module, forwardRef } from '@nestjs/common';
import { VisitSessionService } from './visit-session.service';
import { VisitSessionController } from './visit-session.controller';
import { HisModule } from '../his/his.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [HisModule, forwardRef(() => QueueModule)],
  controllers: [VisitSessionController],
  providers: [VisitSessionService],
  exports: [VisitSessionService],
})
export class VisitSessionModule {}
