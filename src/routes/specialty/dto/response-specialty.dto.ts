import { PartialType } from '@nestjs/swagger';
import { CreateSpecialtyDto } from './request-specialty.dto';

export class UpdateSpecialtyDto extends PartialType(CreateSpecialtyDto) { }
