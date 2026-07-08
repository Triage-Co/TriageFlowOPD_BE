import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ShiftService } from './shift.service';
import { CreateShiftRequestDto, UpdateShiftRequestDto } from './dto/request-shift.dto';


@Controller('shift')
export class ShiftController {
  constructor(private readonly shiftService: ShiftService) { }

  @Post()
  create(@Body() createShiftRequestDto: CreateShiftRequestDto) {
    return this.shiftService.create(createShiftRequestDto);
  }

  @Get()
  findAll() {
    return this.shiftService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.shiftService.findOne(id);
  }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateShiftRequestDto: UpdateShiftRequestDto) {
  //   return this.shiftService.update(id, updateShiftRequestDto);
  // }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.shiftService.remove(id);
  }
}
