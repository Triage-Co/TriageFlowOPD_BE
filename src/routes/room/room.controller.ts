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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoomService } from './room.service';
import {
  CreateRoomRequestDto,
  QueryRoomReqDto,
  UpdateRoomRequestDto,
} from './dto/request-room.dto';

@ApiTags('Room')
@Controller('room')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo phòng logic mới' })
  create(@Body() createRoomRequestDto: CreateRoomRequestDto) {
    return this.roomService.create(createRoomRequestDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách các phòng logic (hỗ trợ phân trang, sắp xếp và lấy kèm roomCode từ physical room)' })
  findAll(@Query() query: QueryRoomReqDto) {
    return this.roomService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết phòng logic theo ID' })
  findOne(@Param('id') id: string) {
    return this.roomService.findOne(id);
  }

  @Get(':id/slots')
  @ApiOperation({ summary: 'Lấy danh sách các slot (khung giờ khám) của một phòng. Có thể lọc theo ngày (YYYY-MM-DD)' })
  getSlotsByRoomId(
    @Param('id') id: string,
    @Query('date') date?: string
  ) {
    return this.roomService.getSlotsByRoomId(id, date);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin phòng logic / Gán hoặc gỡ gán Physical Room' })
  update(
    @Param('id') id: string,
    @Body() updateRoomRequestDto: UpdateRoomRequestDto,
  ) {
    return this.roomService.update(id, updateRoomRequestDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa phòng logic theo ID' })
  remove(@Param('id') id: string) {
    return this.roomService.remove(id);
  }
}

