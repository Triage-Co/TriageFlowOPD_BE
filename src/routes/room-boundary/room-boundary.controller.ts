import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RoomBoundaryService } from './room-boundary.service';
import { CreateRoomBoundaryDto } from './dto/create-room-boundary.dto';
import { UpdateRoomBoundaryDto } from './dto/update-room-boundary.dto';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { IsAdminGuard } from '../../shared/guards/is-admin.guard';

@ApiTags('RoomBoundary')
@Controller('room-boundary')
export class RoomBoundaryController {
  constructor(private readonly roomBoundaryService: RoomBoundaryService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Tạo đường biên mới (Admin)' })
  create(@Body() createRoomBoundaryDto: CreateRoomBoundaryDto) {
    return this.roomBoundaryService.create(createRoomBoundaryDto);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard)
  @ApiOperation({ summary: 'Lấy danh sách đường biên (lọc theo roomId)' })
  @ApiQuery({ name: 'roomId', required: false, type: String })
  findAll(@Query('roomId') roomId?: string) {
    return this.roomBoundaryService.findAll(roomId);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard)
  @ApiOperation({ summary: 'Lấy thông tin chi tiết một đường biên' })
  findOne(@Param('id') id: string) {
    return this.roomBoundaryService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Cập nhật đường biên (Admin)' })
  update(
    @Param('id') id: string,
    @Body() updateRoomBoundaryDto: UpdateRoomBoundaryDto,
  ) {
    return this.roomBoundaryService.update(id, updateRoomBoundaryDto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Xóa đường biên (Admin)' })
  remove(@Param('id') id: string) {
    return this.roomBoundaryService.remove(id);
  }
}
