import { Controller, Get, Query } from '@nestjs/common';
import { SpecialtyService } from './specialty.service';
import { ApiOperation, ApiQuery } from '@nestjs/swagger';

@Controller('specialty')
export class SpecialtyController {
  constructor(private readonly specialtyService: SpecialtyService) {}

  @Get()
  @ApiOperation({
    summary: 'Lấy tất cả chuyên khoa',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Trang hiện tại',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Số lượng dữ liệu trên 1 trang',
    example: 20,
  })
  findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.specialtyService.findAll(page, limit);
  }
}
