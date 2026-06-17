import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { StepService } from './step.service';
import { CreateStepDto } from './dto/request-step.dto';
import { UpdateStepDto } from './dto/response-step.dto';

@Controller('step')
export class StepController {
  constructor(private readonly stepService: StepService) { }

  @Post()
  create(@Body() createStepDto: CreateStepDto) {
    return this.stepService.create(createStepDto);
  }

  @Get()
  findAll() {
    return this.stepService.findAll();
  }

  @Get(':id')
  findStepByFlow(@Param('id') id: string) {
    return this.stepService.findStepByFlow(id);
  }

}
