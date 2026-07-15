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
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { IsRoleGuard } from '../../shared/guards/is-role.guard';
import { roles } from '../../shared/decorator/role.decorator';

@Controller('flow')
@ApiBearerAuth()
@UseGuards(IsAuthGuard)
export class FlowController {
  constructor(private readonly flowService: FlowService) {}

  @Get()
  @roles('ADMIN', 'DOCTOR', 'NURSE', 'ANCILLARY_STAFFS', 'RECEPTIONIST')
  @UseGuards(IsRoleGuard)
  @ApiOperation({
    summary: 'Tìm tất cả flow theo của staff và admin',
  })
  async findAll() {
    return this.flowService.findAll();
  }

  @Get(':id')
  @roles('ADMIN', 'DOCTOR', 'NURSE', 'ANCILLARY_STAFFS', 'RECEPTIONIST')
  @UseGuards(IsRoleGuard)
  @ApiOperation({
    summary: 'Tìm flow theo step id của staff và admin',
  })
  findOne(@Param('id') id: string) {
    return this.flowService.findOne(id);
  }

  @Get('account/step/:step_id')
  @ApiOperation({
    summary: 'Tìm flow theo step id của user',
  })
  findByStepId(@Req() req: any, @Param('step_id') step_id: string) {
    return this.flowService.findOneByStepId(req.user.id, step_id);
  }

  @Get('account')
  @ApiOperation({
    summary: 'Tìm tất cả flow theo step id của user',
  })
  findAllByAccountId(@Req() req: any) {
    return this.flowService.findAllByAccountId(req.user.id);
  }
}
