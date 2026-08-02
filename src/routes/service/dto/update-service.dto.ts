import { PartialType } from '@nestjs/swagger';
import { CreateServiceDto } from './req-service.dto';

export class UpdateServiceDto extends PartialType(CreateServiceDto) {}
