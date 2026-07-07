import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ShiftService } from './shift.service';
import { CreateShiftDto, UpdateShiftDto } from './dto/request-shift.dto';

@Controller('shift')
export class ShiftController {
  constructor(private readonly shiftService: ShiftService) {}

  @Post()
  create(@Body() createShiftDto: CreateShiftDto) {
    return this.shiftService.create(createShiftDto);
  }

  @Get()
  findAll() {
    return this.shiftService.findAll();
  }
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.shiftService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateShiftDto: UpdateShiftDto) {
    return this.shiftService.update(id, updateShiftDto);
  }
}
