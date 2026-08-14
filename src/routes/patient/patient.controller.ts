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
  Query,
} from '@nestjs/common';
import { PatientService } from './patient.service';
import {
  CreatePatientByStaffReqDto,
  CreatePatientReqDto,
  UpdatePatientByStaffReqDto,
  UpdatePatientReqDto,
} from './dto/request-patient.dto';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiSecurity } from '@nestjs/swagger';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { IsRoleGuard } from '../../shared/guards/is-role.guard';
import { roles } from '../../shared/decorator/role.decorator';
import { IsKioskGuard } from '../../shared/guards/is_kiosk.guard';

@Controller('patient')
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  @Get('kiosk')
  @ApiBearerAuth()
  @UseGuards(IsKioskGuard)
  @ApiOperation({
    summary: '[KIOSK] lấy thông tin bệnh nhân (cần đăng nhập)',
  })
  findByKiosk(@Req() req: any) {
    const id = req.user.id || req.user.sub;
    return this.patientService.getOne(id);
  }

  @Post('me')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard)
  @ApiOperation({
    summary: '[USER] tạo bệnh nhân',
  })
  createMyPatient(
    @Req() req: any,
    @Body() createPatientDto: CreatePatientReqDto,
  ) {
    const id = req.user.id || req.user.sub;
    return this.patientService.create(id, createPatientDto);
  }

  @Get('/me')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard)
  @ApiOperation({
    summary: '[USER] lấy tất bệnh nhân',
  })
  getMyPatients(
    @Req() req: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    const id = req.user.sub || req.user.id;
    return this.patientService.getMyPatients(id, page, limit, search);
  }

  @Delete('me/:patient_id')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard)
  @ApiOperation({
    summary: '[USER] xóa bệnh nhân theo patient id',
  })
  removeMyPatient(@Req() req: any, @Param('patient_id') patient_id: string) {
    const id = req.user.id || req.user.sub;
    return this.patientService.remove(id, patient_id);
  }

  @Get('me/:patient_id')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard)
  @ApiOperation({
    summary: '[USER] lấy bệnh nhân theo patient id',
  })
  findMyPatient(@Req() req: any, @Param('patient_id') patient_id: string) {
    const id = req.user.id || req.user.sub;
    return this.patientService.getMyPatient(patient_id, id);
  }

  @Patch('me/:patient_id')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard)
  @ApiOperation({
    summary: '[USER] cập nhật bệnh nhân theo patient id',
  })
  updateMyPatient(
    @Req() req: any,
    @Param('patient_id') patient_id: string,
    @Body() updatePatientReqDto: UpdatePatientReqDto,
  ) {
    const id = req.user.id || req.user.sub;
    return this.patientService.update(patient_id, updatePatientReqDto, id);
  }

  @Post()
  @roles(
    'ADMIN',
    'LAB_TECHNICIAN',
    'PHARMACIST',
    'DOCTOR',
    'NURSE',
    'RECEPTIONIST',
  )
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[STAFF - ADMIN] tạo bệnh nhân',
  })
  create(@Body() createPatientDto: CreatePatientByStaffReqDto) {
    const { account_id, ...createDto } = createPatientDto;
    return this.patientService.create(account_id, createDto);
  }

  @Get()
  @roles(
    'ADMIN',
    'LAB_TECHNICIAN',
    'PHARMACIST',
    'DOCTOR',
    'NURSE',
    'RECEPTIONIST',
  )
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[STAFF - ADMIN] lấy tất cả bệnh nhân',
  })
  @ApiQuery({
    name: 'page',
    description: 'Số trang',
    type: 'number',
    required: false,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Số lượng trên mỗi trang',
    type: 'number',
    required: false,
  })
  @ApiQuery({
    name: 'search',
    description: 'Từ khóa tìm kiếm',
    type: 'string',
    required: false,
  })
  getAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.patientService.getAll(page, limit, search);
  }

  @Get(':patient_id')
  @roles(
    'ADMIN',
    'LAB_TECHNICIAN',
    'PHARMACIST',
    'DOCTOR',
    'NURSE',
    'RECEPTIONIST',
  )
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[STAFF - ADMIN] lấy bệnh nhân theo patient id',
  })
  findOne(@Param('patient_id') patient_id: string) {
    return this.patientService.getOne(patient_id);
  }

  @Patch('/:patient_id')
  @roles(
    'ADMIN',
    'LAB_TECHNICIAN',
    'PHARMACIST',
    'DOCTOR',
    'NURSE',
    'RECEPTIONIST',
  )
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[STAFF - ADMIN] cập nhật bệnh nhân theo patient id',
  })
  update(
    @Param('patient_id') patient_id: string,
    @Body() updatePatientReqDto: UpdatePatientByStaffReqDto,
  ) {
    const { account_id, ...patientDto } = updatePatientReqDto;
    return this.patientService.update(patient_id, patientDto, account_id);
  }

  @Delete(':patient_id')
  @roles(
    'ADMIN',
    'LAB_TECHNICIAN',
    'PHARMACIST',
    'DOCTOR',
    'NURSE',
    'RECEPTIONIST',
  )
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[STAFF - ADMIN] xóa bệnh nhân theo patient id',
  })
  remove(@Param('patient_id') patient_id: string) {
    return this.patientService.remove(patient_id);
  }
}
