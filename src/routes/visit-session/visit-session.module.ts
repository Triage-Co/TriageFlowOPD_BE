import { Module } from '@nestjs/common';
import { VisitSessionService } from './visit-session.service';
import { VisitSessionController } from './visit-session.controller';
import { HisModule } from '../his/his.module';

@Module({
  imports: [HisModule],
  controllers: [VisitSessionController],
  providers: [VisitSessionService],
  exports: [VisitSessionService],
})
export class VisitSessionModule {}
