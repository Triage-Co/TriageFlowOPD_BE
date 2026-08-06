import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { DoctorService } from './doctor.service';
import { ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';

@Controller('doctor')
export class DoctorController {
  constructor(private readonly doctorService: DoctorService) {}

  @Get('patients')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard)
  @ApiQuery({
    name: 'date',
    example: '2026-07-04',
    required: false,
  })
  @ApiOperation({
    summary: "Lấy danh sách bệnh nhân mà bác sĩ cần khám trong ngày"
  })
  getPatients(@Req() req: any, @Query('date') date: string) {
    const id = req.user.id || req.user.sub;
    console.log(id, date);
    return this.doctorService.getPatients(id, date);
  }

  @Get('patients/queue/:id')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard)
  @ApiOperation({
    summary: "Lấy chi tiết bệnh nhân theo queue_id"
  })
  getPatientByQueueId(@Req() req: any, @Param('id') queueId: string) {
    const id = req.user.id || req.user.sub;
    return this.doctorService.getPatientByQueueId(queueId, id);
  }

  @Get()
  findAll() {
    return this.doctorService.findAll();
  }

  @Get('specialty')
  @ApiQuery({
    name: 'date_time',
    type: 'string',
    example: '2026-05-26',
    required: false,
  })
  @ApiQuery({
    name: 'specialty_code',
    type: 'string',
    example: 'SP_1',
    required: false,
    description: 'id của recommended_specialist',
  })
  findAllWithSpecialCode(
    @Query('specialty_code') specialty_code: string,
    @Query('date_time') dateTimeStr: string,
  ) {
    return this.doctorService.findAllWithSpecialCode(
      specialty_code,
      dateTimeStr,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.doctorService.findOne(id);
  }

  @Get(':id/slot')
  findOneWithSlotAndDate(
    @Param('id') id: string,
    @Query('date') dateTimeStr: string,
  ) {
    return this.doctorService.findOneWithSlotAndDate(id, dateTimeStr);
  }
}
