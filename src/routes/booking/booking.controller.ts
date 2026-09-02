import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { BookingService } from './booking.service';
import {
  BookingSpecialtyDto,
  CreateBookingCashPackageDto,
  CreateBookingRequestDto,
  CreateBookingWithPackageDto,
  UpdateBookingRequestDto,
} from './dto/request-booking.dto';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { IsRoleGuard } from '../../shared/guards/is-role.guard';
import { roles } from '../../shared/decorator/role.decorator';

@Controller('booking')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo booking thông thường (thanh toán lúc đến)' })
  create(@Body() createBookingRequestDto: CreateBookingRequestDto) {
    return this.bookingService.create(createBookingRequestDto);
  }

  @Post('/cash')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @roles('RECEPTIONIST')
  @ApiOperation({
    summary: 'Tạo booking khám thường thanh toán bằng tiền mặt (dành cho lễ tân)',
    description:
      'Tạo booking khám thường, hóa đơn và hoàn thành thanh toán tiền mặt ngay lập tức không tạo mã QR.',
  })
  createCash(@Body() createBookingRequestDto: CreateBookingRequestDto) {
    return this.bookingService.createCashBooking(createBookingRequestDto);
  }

  @Post('/cash-package')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @roles('RECEPTIONIST')
  @ApiOperation({
    summary: 'Tạo booking gói khám thanh toán bằng tiền mặt (dành cho lễ tân)',
    description:
      'Tạo booking gói khám, hóa đơn và hoàn thành thanh toán tiền mặt ngay lập tức, tự động tạo luồng khám và cấp số thứ tự.',
  })
  createCashPackage(@Body() dto: CreateBookingCashPackageDto) {
    return this.bookingService.createCashBookingWithPackage(dto);
  }

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
