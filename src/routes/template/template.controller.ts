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
import { TemplateService } from './template.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { roles } from '../../shared/decorator/role.decorator';
import { IsRoleGuard } from '../../shared/guards/is-role.guard';

@Controller('template')
@ApiBearerAuth()
@UseGuards(IsAuthGuard)
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Post()
  @roles('ADMIN')
  @UseGuards(IsRoleGuard)
  create(@Body() createTemplateDto: CreateTemplateDto) {
    return this.templateService.create(createTemplateDto);
  }

  @Get()
  @roles('ADMIN', 'DOCTOR', 'ANCILLARY_STAFFS', 'NURSE')
  @UseGuards(IsRoleGuard)
  findAll() {
    return this.templateService.findAll();
  }

  @Get('name/:name')
  @roles('ADMIN', 'DOCTOR', 'ANCILLARY_STAFFS', 'NURSE')
  @UseGuards(IsRoleGuard)
  findByName(@Param('name') name: string) {
    return this.templateService.findByName(name);
  }

  @Get(':id')
  @roles('ADMIN', 'DOCTOR', 'ANCILLARY_STAFFS', 'NURSE')
  @UseGuards(IsRoleGuard)
  findOne(@Param('id') id: string) {
    return this.templateService.findOne(id);
  }

  @Patch(':id')
  @roles('ADMIN')
  @UseGuards(IsRoleGuard)
  update(
    @Param('id') id: string,
    @Body() updateTemplateDto: UpdateTemplateDto,
  ) {
    return this.templateService.update(id, updateTemplateDto);
  }

  @Delete(':id')
  @roles('ADMIN')
  @UseGuards(IsRoleGuard)
  remove(@Param('id') id: string) {
    return this.templateService.remove(id);
  }
}
