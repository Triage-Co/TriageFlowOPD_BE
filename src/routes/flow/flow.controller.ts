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
import { FlowService } from './flow.service';
import { CreateFlowDto } from './dto/create-flow.dto';
import { UpdateFlowDto } from './dto/update-flow.dto';
import { ApiBearerAuth, ApiBody, ApiOperation } from '@nestjs/swagger';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { IsRoleGuard } from '../../shared/guards/is-role.guard';
import { roles } from '../../shared/decorator/role.decorator';
import { IsKioskGuard } from '../../shared/guards/is_kiosk.guard';

@Controller('flow')
export class FlowController {
  constructor(private readonly flowService: FlowService) {}

  @Get('kiosk/patient/:patient_id')
  @ApiBearerAuth()
  @UseGuards(IsKioskGuard)
  @ApiOperation({
    summary: '[KIOSK] Tìm tất cả lịch sử flow theo Patient ID',
  })
  async findAllByPatientIdInKiosk(@Param('patient_id') patientId: string) {
    return this.flowService.findAllByPatientId(patientId);
  }

  @Get('kiosk/patient/:patient_id/active')
  @ApiBearerAuth()
  @UseGuards(IsKioskGuard)
  @ApiOperation({
    summary: '[KIOSK] Tìm flow đang chạy (PENDING/IN_PROGRESS) theo Patient ID',
  })
  async findIsActiveByPatientIdInKiosk(@Param('patient_id') patientId: string) {
    return this.flowService.findIsActiveByPatientId(patientId);
  }

  @Get('patient/:patient_id')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard)
  @ApiOperation({
    summary: 'Tìm tất cả lịch sử flow theo Patient ID',
  })
  async findAllByPatientId(@Param('patient_id') patientId: string) {
    return this.flowService.findAllByPatientId(patientId);
  }

  @Get('patient/:patient_id/active')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard)
  @ApiOperation({
    summary: 'Tìm flow đang chạy (PENDING/IN_PROGRESS) theo Patient ID',
  })
  async findIsActiveByPatientId(@Param('patient_id') patientId: string) {
    return this.flowService.findIsActiveByPatientId(patientId);
  }

  @Get()
  @roles('ADMIN', 'DOCTOR', 'NURSE', 'ANCILLARY_STAFFS', 'RECEPTIONIST')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiOperation({
    summary: 'Tìm tất cả flow theo của staff và admin',
  })
  async findAll() {
    return this.flowService.findAll();
  }

  @Get(':id')
  @roles('ADMIN', 'DOCTOR', 'NURSE', 'ANCILLARY_STAFFS', 'RECEPTIONIST')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiOperation({
    summary: 'Tìm flow theo step id của staff và admin',
  })
  findOne(@Param('id') id: string) {
    return this.flowService.findOne(id);
  }

  @Post('/assign/:flow_id')
  @ApiBearerAuth()
  @roles('ADMIN', 'DOCTOR')
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        template_id: {
          title: 'template_id',
          example: '4ce502df-6f77-4eac-8e6f-7c1bdad92bcc',
        },
      },
    },
  })
  async doctorAssignTemplate(
    @Param('flow_id') flowId: string,
    @Body('template_id') templateId: string,
  ) {
    return await this.flowService.addTemplateToFlow(flowId, templateId);
  }
}
