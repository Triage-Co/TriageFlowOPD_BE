import { PartialType } from '@nestjs/swagger';
import { CreateTriageConfigDto } from './create-triage_config.dto';

export class UpdateTriageConfigDto extends PartialType(CreateTriageConfigDto) {}
