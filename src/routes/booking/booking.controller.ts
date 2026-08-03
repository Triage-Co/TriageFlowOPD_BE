import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { BookingService } from './booking.service';
import {
  BookingSpecialtyDto,
  CreateBookingRequestDto,
  CreateBookingWithPackageDto,
  UpdateBookingRequestDto,
} from './dto/request-booking.dto';
import { ApiOperation } from '@nestjs/swagger';

@Controller('booking')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo booking thông thường (thanh toán lúc đến)' })
  create(@Body() createBookingRequestDto: CreateBookingRequestDto) {
    return this.bookingService.create(createBookingRequestDto);
  }

  /**
   * Tạo booking với gói khám (Exam_Package).
   * Flow sẽ được tạo tự động sau khi thanh toán gói xong.
   */
  @Post('/with-package')
  @ApiOperation({
    summary: 'Tạo booking + chọn gói khám (Exam_Package)',
    description:
      'Tạo booking và đơn thanh toán gói khám. ' +
      'Flow sẽ được tạo tự động sau khi thanh toán thành công.',
  })
  createWithPackage(@Body() dto: CreateBookingWithPackageDto) {
    return this.bookingService.createBookingWithPackage(dto);
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
  @ApiOperation({ summary: 'Đặt lịch tự động theo kết quả triage' })
  bookingWithSpecialty(@Body() bookingSpecialtyDto: BookingSpecialtyDto) {
    return this.bookingService.bookingWithSpecialty(bookingSpecialtyDto);
  }
}
