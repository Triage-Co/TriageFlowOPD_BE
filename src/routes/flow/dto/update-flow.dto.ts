import { PartialType } from '@nestjs/swagger';
import { CreateFlowDto } from './request-flow.dto';

export class UpdateFlowDto extends PartialType(CreateFlowDto) { }
