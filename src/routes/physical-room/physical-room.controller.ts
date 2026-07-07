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
import { PhysicalRoomService } from './physical-room.service';
import { CreatePhysicalRoomDto } from './dto/create-physical-room.dto';
import { UpdatePhysicalRoomDto } from './dto/update-physical-room.dto';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { IsAdminGuard } from '../../shared/guards/is-admin.guard';

@ApiTags('PhysicalRoom')
@Controller('physical-room')
export class PhysicalRoomController {
  constructor(private readonly physicalRoomService: PhysicalRoomService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Tạo phòng mới (Admin)' })
  create(@Body() createPhysicalRoomDto: CreatePhysicalRoomDto) {
    return this.physicalRoomService.create(createPhysicalRoomDto);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard)
  @ApiOperation({ summary: 'Lấy danh sách phòng (lọc theo floorId)' })
  @ApiQuery({ name: 'floorId', required: false, type: String })
  findAll(@Query('floorId') floorId?: string) {
    return this.physicalRoomService.findAll(floorId);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard)
  @ApiOperation({ summary: 'Lấy chi tiết một phòng' })
  findOne(@Param('id') id: string) {
    return this.physicalRoomService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Cập nhật phòng (Admin)' })
  update(
    @Param('id') id: string,
    @Body() updatePhysicalRoomDto: UpdatePhysicalRoomDto,
  ) {
    return this.physicalRoomService.update(id, updatePhysicalRoomDto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Xóa phòng (Admin)' })
  remove(@Param('id') id: string) {
    return this.physicalRoomService.remove(id);
  }
}
