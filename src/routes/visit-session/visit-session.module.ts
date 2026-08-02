import { Module } from '@nestjs/common';
import { VisitSessionService } from './visit-session.service';
import { VisitSessionController } from './visit-session.controller';

@Module({
  controllers: [VisitSessionController],
  providers: [VisitSessionService],
  exports: [VisitSessionService],
})
export class VisitSessionModule {}
