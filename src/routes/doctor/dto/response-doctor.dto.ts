import { PartialType } from '@nestjs/swagger';
import { CreateDoctorDto } from './request-doctor.dto';

export class UpdateDoctorDto extends PartialType(CreateDoctorDto) {}
