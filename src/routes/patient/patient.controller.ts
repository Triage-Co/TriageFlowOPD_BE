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
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { IsRoleGuard } from '../../shared/guards/is-role.guard';
import { roles } from '../../shared/decorator/role.decorator';

@Controller('patient')
@ApiBearerAuth()
@UseGuards(IsAuthGuard)
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  @Post('me')
  @ApiOperation({
    summary: '[USER] tạo bệnh nhân của chính user',
  })
  create(@Req() req: any, @Body() createPatientDto: CreatePatientReqDto) {
    const { id } = req.user;
    return this.patientService.create(id, createPatientDto);
  }

  @Get('/me')
  @ApiOperation({
    summary: '[USER] lấy tất bệnh nhân theo của chính user',
  })
  getMyPatients(@Req() req: any) {
    const { id } = req['user'];
    return this.patientService.getMyPatients(id);
  }

  @Get()
  @roles('ADMIN', 'ANCILLARY_STAFFS', 'DOCTOR', 'NURSE', 'RECEPTIONIST')
  @UseGuards(IsRoleGuard)
  @ApiOperation({
    summary: '[STAFF] lấy tất cả bệnh nhân',
  })
  getAll() {
    return this.patientService.getAll();
  }

  @Get('me/:patient_id')
  @ApiOperation({
    summary: '[USER] lấy bệnh nhân theo patient id của chính user',
  })
  findMyPatient(@Req() req: any, @Param('patient_id') patient_id: string) {
    const { id } = req['user'];
    return this.patientService.getMyPatient(patient_id, id);
  }

  @Get(':patient_id')
  @roles('ADMIN', 'ANCILLARY_STAFFS', 'DOCTOR', 'NURSE', 'RECEPTIONIST')
  @UseGuards(IsRoleGuard)
  @ApiOperation({
    summary: '[STAFF] lấy bệnh nhân theo patient id',
  })
  findOne(@Param('patient_id') patient_id: string) {
    return this.patientService.getOne(patient_id);
  }

  @Patch('me/:patient_id')
  @ApiOperation({
    summary: '[USER] cập nhật bệnh nhân theo patient id của chính user',
  })
  update(
    @Req() req: any,
    @Param('patient_id') patient_id: string,
    @Body() updatePatientReqDto: UpdatePatientReqDto,
  ) {
    const { id } = req.user;
    return this.patientService.update(id, patient_id, updatePatientReqDto);
  }

  @Delete('me/:patient_id')
  @ApiOperation({
    summary: '[USER] xóa bệnh nhân theo patient id của chính user',
  })
  remove(@Req() req: any, @Param('patient_id') patient_id: string) {
    const { id } = req['user'];
    return this.patientService.remove(id, patient_id);
  }
}
