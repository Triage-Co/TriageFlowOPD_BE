import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/request-booking.dto';
import { ApiOperation } from '@nestjs/swagger';

@Controller('booking')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  create(@Body() createBookingDto: CreateBookingDto) {
    return this.bookingService.create(createBookingDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Lấy lịch hẹn theo id',
  })
  findOne(@Param('id') id: string) {
    return this.bookingService.findOne(id);
  }

  @Get()
  @ApiOperation({
    summary: 'Lấy toàn bộ lịch hẹn',
  })
  findMany() {
    return this.bookingService.findMany();
  }
}
