import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PatientService } from './patient.service';
import {
  CreatePatientReqDto,
  UpdatePatientReqDto,
} from './dto/request-patient.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';

@Controller('patient')
@ApiBearerAuth()
@UseGuards(IsAuthGuard)
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  @Post()
  create(@Req() req: any, @Body() createPatientDto: CreatePatientReqDto) {
    const { id } = req.user;
    return this.patientService.create(id, createPatientDto);
  }

  @Get()
  findAll(@Req() req: any) {
    const { id } = req['user'];
    return this.patientService.findAll(id);
  }

  @Get(':patient_id')
  findOne(@Req() req: any, @Param('patient_id') patient_id: string) {
    const { id } = req['user'];
    return this.patientService.findOne(id, patient_id);
  }

  @Patch(':patient_id')
  update(
    @Req() req: any,
    @Param('patient_id') patient_id: string,
    @Body() updatePatientReqDto: UpdatePatientReqDto,
  ) {
    const { id } = req.user;
    return this.patientService.update(id, patient_id, updatePatientReqDto);
  }

  @Delete(':patient_id')
  remove(@Req() req: any, @Param('patient_id') patient_id: string) {
    const { id } = req['user'];
    return this.patientService.remove(id, patient_id);
  }
}
