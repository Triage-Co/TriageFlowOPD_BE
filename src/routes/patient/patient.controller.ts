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
  CreatePatientByStaffReqDto,
  CreatePatientReqDto,
  UpdatePatientByStaffReqDto,
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
    summary: '[USER] tạo bệnh nhân',
  })
  createMyPatient(
    @Req() req: any,
    @Body() createPatientDto: CreatePatientReqDto,
  ) {
    const { id } = req.user;
    return this.patientService.create(id, createPatientDto);
  }

  @Get('/me')
  @ApiOperation({
    summary: '[USER] lấy tất bệnh nhân',
  })
  getMyPatients(@Req() req: any) {
    const { id } = req['user'];
    return this.patientService.getMyPatients(id);
  }

  @Delete('me/:patient_id')
  @ApiOperation({
    summary: '[USER] xóa bệnh nhân theo patient id',
  })
  removeMyPatient(@Req() req: any, @Param('patient_id') patient_id: string) {
    const { id } = req['user'];
    return this.patientService.remove(id, patient_id);
  }

  @Get('me/:patient_id')
  @ApiOperation({
    summary: '[USER] lấy bệnh nhân theo patient id',
  })
  findMyPatient(@Req() req: any, @Param('patient_id') patient_id: string) {
    const { id } = req['user'];
    return this.patientService.getMyPatient(patient_id, id);
  }

  @Patch('me/:patient_id')
  @ApiOperation({
    summary: '[USER] cập nhật bệnh nhân theo patient id',
  })
  updateMyPatient(
    @Req() req: any,
    @Param('patient_id') patient_id: string,
    @Body() updatePatientReqDto: UpdatePatientReqDto,
  ) {
    const { id } = req.user;
    return this.patientService.update(patient_id, updatePatientReqDto, id);
  }

  @Post()
  @roles('ADMIN', 'ANCILLARY_STAFFS', 'DOCTOR', 'NURSE', 'RECEPTIONIST')
  @UseGuards(IsRoleGuard)
  @ApiOperation({
    summary: '[STAFF] tạo bệnh nhân',
  })
  create(@Body() createPatientDto: CreatePatientByStaffReqDto) {
    const { account_id, ...createDto } = createPatientDto;
    return this.patientService.create(account_id, createDto);
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

  @Get(':patient_id')
  @roles('ADMIN', 'ANCILLARY_STAFFS', 'DOCTOR', 'NURSE', 'RECEPTIONIST')
  @UseGuards(IsRoleGuard)
  @ApiOperation({
    summary: '[STAFF] lấy bệnh nhân theo patient id',
  })
  findOne(@Param('patient_id') patient_id: string) {
    return this.patientService.getOne(patient_id);
  }

  @Patch('/:patient_id')
  @roles('ADMIN', 'ANCILLARY_STAFFS', 'DOCTOR', 'NURSE', 'RECEPTIONIST')
  @UseGuards(IsRoleGuard)
  @ApiOperation({
    summary: '[STAFF] cập nhật bệnh nhân theo patient id',
  })
  update(
    @Param('patient_id') patient_id: string,
    @Body() updatePatientReqDto: UpdatePatientByStaffReqDto,
  ) {
    const { account_id, ...patientDto } = updatePatientReqDto;
    return this.patientService.update(patient_id, patientDto, account_id);
  }

  @Delete(':patient_id')
  @roles('ADMIN', 'ANCILLARY_STAFFS', 'DOCTOR', 'NURSE', 'RECEPTIONIST')
  @UseGuards(IsRoleGuard)
  @ApiOperation({
    summary: '[STAFF] xóa bệnh nhân theo patient id',
  })
  remove(@Param('patient_id') patient_id: string) {
    return this.patientService.remove(patient_id);
  }
}
