import { PartialType } from '@nestjs/swagger';
import { CreateStaffReqDto } from './req-staff.dto';

export class UpdateStaffDto extends PartialType(CreateStaffReqDto) { }
