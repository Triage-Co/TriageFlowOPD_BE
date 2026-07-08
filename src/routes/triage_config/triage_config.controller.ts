import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { TriageConfigService } from './triage_config.service';
import { CreateTriageConfigDto } from './dto/create-triage_config.dto';

@Controller('triage-config')
export class TriageConfigController {
  constructor(private readonly triageConfigService: TriageConfigService) {}

  @Post()
  create(@Body() createTriageConfigDto: CreateTriageConfigDto) {
    return this.triageConfigService.create(createTriageConfigDto);
  }

  @Get()
  findAll() {
    return this.triageConfigService.findAll();
  }
}
