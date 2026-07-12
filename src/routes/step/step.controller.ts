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
} from './dto/req-step.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { IsRoleGuard } from '../../shared/guards/is-role.guard';
import { roles } from '../../shared/decorator/role.decorator';

@Controller('step')
@ApiBearerAuth()
@UseGuards(IsAuthGuard)
export class StepController {
  constructor(private readonly stepService: StepService) {}

  @Get(':step_id')
  findById(@Req() req: any, @Param('step_id') step_id: string) {
    const { id } = req.user;
    return this.stepService.findByIdAndAccountId(id, step_id);
  }

  @Post('parent')
  @roles('ADMIN', 'DOCTOR')
  @UseGuards(IsRoleGuard)
  createParentStep(@Body() createParentStepReqDto: CreateParentStepReqDto) {
    return this.stepService.createParentStep(createParentStepReqDto);
  }
  @Post('sub')
  @roles('ADMIN', 'DOCTOR')
  @UseGuards(IsRoleGuard)
  createSubStep(@Body() createSubStepReqDto: CreateSubStepReqDto) {
    return this.stepService.createSubStep(createSubStepReqDto);
  }
  @Post('dependency')
  @roles('ADMIN', 'DOCTOR')
  @UseGuards(IsRoleGuard)
  createDependency(@Body() createDependencyReqDto: CreateDependencyReqDto) {
    return this.stepService.createDependency(createDependencyReqDto);
  }
  @Patch(':step_id/complete')
  @roles('ADMIN', 'DOCTOR', 'ANCILLARY_STAFFS', 'NURSE')
  @UseGuards(IsRoleGuard)
  completeStep(@Param('step_id') stepId: string) {
    return this.stepService.completeStep(stepId);
  }
}
