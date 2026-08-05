import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ShiftService } from './shift.service';
import {
  CreateShiftRequestDto,
  UpdateShiftRequestDto,
} from './dto/request-shift.dto';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';

@ApiTags('Shift')
@Controller('shift')
export class ShiftController {
  constructor(private readonly shiftService: ShiftService) {}

  private getUser(req: any) {
    const u = req?.user;
    return {
      id: u?.account_id || u?.id || u?.sub || 'system',
      role: u?.role || 'USER',
    };
  }

  @Get('me')
  @UseGuards(IsAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách ca trực cá nhân của Staff đăng nhập' })
  @ApiQuery({ name: 'date', required: false, description: 'Ngày cần tra cứu (YYYY-MM-DD), mặc định hôm nay' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách ca trực thành công.' })
  async findMyShifts(@Req() req: any, @Query('date') dateStr?: string) {
    const user = this.getUser(req);
    return await this.shiftService.findMyShifts(user.id, dateStr);
  }

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
