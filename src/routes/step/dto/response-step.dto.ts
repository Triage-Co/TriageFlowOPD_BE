import { PartialType } from '@nestjs/swagger';
import { CreateStepDto } from './request-step.dto';

export class UpdateStepDto extends PartialType(CreateStepDto) { }
