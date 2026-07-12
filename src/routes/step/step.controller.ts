import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { StepService } from './step.service';
import {
  CreateDependencyReqDto,
  CreateParentStepReqDto,
  CreateSubStepReqDto,
} from './dto/req-step.dto';

@Controller('step')
export class StepController {
  constructor(private readonly stepService: StepService) {}

  @Post('parent')
  createParentStep(@Body() createParentStepReqDto: CreateParentStepReqDto) {
    return this.stepService.createParentStep(createParentStepReqDto);
  }
  @Post('sub')
  createSubStep(@Body() createSubStepReqDto: CreateSubStepReqDto) {
    return this.stepService.createSubStep(createSubStepReqDto);
  }
  @Post('dependency')
  createDependency(@Body() createDependencyReqDto: CreateDependencyReqDto) {
    return this.stepService.createDependency(createDependencyReqDto);
  }
  @Patch(':step_id/complete')
  completeStep(@Param('step_id') stepId: string) {
    return this.stepService.completeStep(stepId);
  }
}
