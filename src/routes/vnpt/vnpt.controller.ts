import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { VnptService } from './vnpt.service';
import { ApiBearerAuth } from '@nestjs/swagger';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';

@Controller('vnpt')
export class VnptController {
  constructor(private readonly vnptService: VnptService) {}

  @Get('key')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard)
  findAll() {
    return this.vnptService.findAll();
  }
}
