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
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { AuthGuard } from '@nestjs/passport';

@Controller('doctor')
export class DoctorController {
  constructor(private readonly doctorService: DoctorService) { }

  @Get('patients')
  @UseGuards(AuthGuard("jwt"))
  @ApiQuery({
    name: 'date',
    example: '2026-07-04',
    required: false,
  })
  getPatients(@Req() req: any, @Query('date') date: string) {
    const { id } = req.user;
    return this.doctorService.getPatients(id, date);
  }

  @Get('patients/queue/:id')
  @UseGuards(AuthGuard("jwt"))
  getPatientByQueueId(@Req() req: any, @Param('id') queueId: string) {
    const { id } = req.user;
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
