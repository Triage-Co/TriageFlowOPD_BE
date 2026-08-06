import { Module } from '@nestjs/common';
import { ExamPackageService } from './exam-package.service';
import { ExamPackageController } from './exam-package.controller';

@Module({
  controllers: [ExamPackageController],
  providers: [ExamPackageService],
})
export class ExamPackageModule {}
