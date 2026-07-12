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

@Controller('flow')
@ApiBearerAuth()
@UseGuards(IsAuthGuard)
export class FlowController {
  constructor(private readonly flowService: FlowService) {}

  @Get(':step_id')
  @ApiOperation({
    description: 'Tìm flow theo step id',
  })
  findOne(@Req() req: any, @Param('step_id') step_id: string) {
    return this.flowService.findOneByStepId(req.user.id, step_id);
  }

  @Get()
  @ApiOperation({
    description: 'Tìm tất cả flow theo step id',
  })
  findAll(@Req() req: any) {
    return this.flowService.findAll(req.user.id);
  }
}
