import { PartialType } from '@nestjs/swagger';
import { CreateExamPackageDto } from './create-exam-package.dto';

export class UpdateExamPackageDto extends PartialType(CreateExamPackageDto) {}
