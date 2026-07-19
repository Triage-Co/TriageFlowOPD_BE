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
import { StepService } from './step.service';
import {
  CreateDependencyReqDto,
  CreateParentStepReqDto,
  CreateSubStepReqDto,
  UpdateStepReqDto,
  UpdateStepStatusReqDto,
} from './dto/req-step.dto';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { IsRoleGuard } from '../../shared/guards/is-role.guard';
import { roles } from '../../shared/decorator/role.decorator';

@Controller('step')
@ApiBearerAuth()
@UseGuards(IsAuthGuard)
export class StepController {
  constructor(private readonly stepService: StepService) {}

  @Get('account/:step_id')
  @ApiOperation({
    summary: 'Tìm step theo step id của user',
  })
  findByIdAndAccountId(@Req() req: any, @Param('step_id') step_id: string) {
    const { id } = req.user;
    return this.stepService.findByIdAndAccountId(id, step_id);
  }

  @Get(':step_id')
  @ApiOperation({
    summary: 'Tìm step theo step id của user',
  })
  @roles('ADMIN', 'DOCTOR', 'ANCILLARY_STAFFS', 'NURSE', 'RECEPTIONIST')
  @UseGuards(IsRoleGuard)
  @ApiOperation({
    summary: 'Tìm step theo step id của staff',
  })
  findById(@Param('step_id') step_id: string) {
    return this.stepService.findById(step_id);
  }

  @Post('parent')
  @roles('ADMIN', 'DOCTOR')
  @UseGuards(IsRoleGuard)
  @ApiOperation({
    summary: 'Tạo step cha của admin và doctor',
  })
  createParentStep(@Body() createParentStepReqDto: CreateParentStepReqDto) {
    return this.stepService.createParentStep(createParentStepReqDto);
  }
  @Post('sub')
  @roles('ADMIN', 'DOCTOR')
  @UseGuards(IsRoleGuard)
  @ApiOperation({
    summary: 'Tạo step con của admin và doctor',
  })
  createSubStep(@Body() createSubStepReqDto: CreateSubStepReqDto) {
    return this.stepService.createSubStep(createSubStepReqDto);
  }
  @Post('dependency')
  @roles('ADMIN', 'DOCTOR')
  @UseGuards(IsRoleGuard)
  @ApiOperation({
    summary:
      'Tạo phụ thuộc (waiting_step (step hiện tại), required_step (step cần hoàn thành)) của admin và doctor',
  })
  createDependency(@Body() createDependencyReqDto: CreateDependencyReqDto) {
    return this.stepService.createDependency(createDependencyReqDto);
  }
  @Patch(':step_id/complete')
  @roles('ADMIN', 'DOCTOR', 'ANCILLARY_STAFFS', 'NURSE')
  @UseGuards(IsRoleGuard)
  @ApiOperation({
    summary: 'Cập nhật trạng thái step của staff',
  })
  completeStep(@Param('step_id') stepId: string) {
    return this.stepService.completeStep(stepId);
  }

  @Patch(':step_id')
  @roles('ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE', 'ANCILLARY_STAFFS')
  @UseGuards(IsRoleGuard)
  @ApiOperation({
    summary:
      'Cập nhật thông tin chung của step (nhân viên, phòng, trạng thái thanh toán...)',
  })
  updateStep(
    @Param('step_id') stepId: string,
    @Body() updateStepReqDto: UpdateStepReqDto,
  ) {
    return this.stepService.updateStep(stepId, updateStepReqDto);
  }

  @Patch(':step_id/status')
  @roles('ADMIN', 'DOCTOR', 'ANCILLARY_STAFFS', 'NURSE', 'RECEPTIONIST')
  @UseGuards(IsRoleGuard)
  @ApiOperation({
    summary: 'Cập nhật trạng thái của step (IN_PROGRESS, CANCELLED...)',
  })
  updateStepStatus(
    @Param('step_id') stepId: string,
    @Body() updateStepStatusReqDto: UpdateStepStatusReqDto,
  ) {
    return this.stepService.updateStepStatus(stepId, updateStepStatusReqDto);
  }
}
