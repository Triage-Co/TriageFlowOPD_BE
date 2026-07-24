import { PartialType } from '@nestjs/swagger';
import { CreateBoundaryDto } from './create-boundary.dto';

export class UpdateBoundaryDto extends PartialType(CreateBoundaryDto) {}
