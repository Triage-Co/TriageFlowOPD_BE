import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { BookingService } from './booking.service';
import {
  BookingSpecialtyDto,
  CreateBookingRequestDto,
  UpdateBookingRequestDto,
} from './dto/request-booking.dto';

@Controller('booking')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  create(@Body() createBookingRequestDto: CreateBookingRequestDto) {
    return this.bookingService.create(createBookingRequestDto);
  }

  @Get()
  findAll() {
    return this.bookingService.findAll();
  }

  @Get('/generate')
  generateNumber(@Query('step-id') step_id: string) {
    return this.bookingService.generateNumber(step_id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bookingService.findOne(id);
  }

  @Post('/recommend')
  bookingWithSpecialty(@Body() bookingSpecialtyDto: BookingSpecialtyDto) {
    return this.bookingService.bookingWithSpecialty(bookingSpecialtyDto);
  }
}
