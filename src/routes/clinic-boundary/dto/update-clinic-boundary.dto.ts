import { PartialType } from '@nestjs/swagger';
import { CreateClinicBoundaryDto } from './create-clinic-boundary.dto';

export class UpdateClinicBoundaryDto extends PartialType(CreateClinicBoundaryDto) {}
