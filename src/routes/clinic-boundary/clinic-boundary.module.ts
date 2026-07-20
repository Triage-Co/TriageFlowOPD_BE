import { Module } from '@nestjs/common';
import { ClinicBoundaryService } from './clinic-boundary.service';
import { ClinicBoundaryController } from './clinic-boundary.controller';

@Module({
  providers: [ClinicBoundaryService],
  controllers: [ClinicBoundaryController],
})
export class ClinicBoundaryModule {}
