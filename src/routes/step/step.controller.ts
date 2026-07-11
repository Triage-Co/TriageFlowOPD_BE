import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { StepService } from './step.service';
import { CreateParentStepReqDto, CreateSubStepReqDto } from './dto/req-step.dto';

@Controller('step')
export class StepController {
  constructor(private readonly stepService: StepService) { }

  @Post("parent")
  createParentStep(@Body() createParentStepReqDto: CreateParentStepReqDto) {
    return this.stepService.createParentStep(createParentStepReqDto);
  }
  @Post("sub")
  createSubStep(@Body() createSubStepReqDto: CreateSubStepReqDto) {
    return this.stepService.createSubStep(createSubStepReqDto);
  }

  @Get()
  findAll() {
    return this.stepService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.stepService.findOne(+id);
  }


  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.stepService.remove(+id);
  }
}
