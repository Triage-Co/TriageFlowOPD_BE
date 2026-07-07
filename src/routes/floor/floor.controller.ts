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
import { FloorService } from './floor.service';
import { CreateFloorDto } from './dto/create-floor.dto';
import { UpdateFloorDto } from './dto/update-floor.dto';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { IsAdminGuard } from '../../shared/guards/is-admin.guard';

@ApiTags('Floor')
@Controller('floor')
export class FloorController {
  constructor(private readonly floorService: FloorService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Tạo tầng mới (Admin)' })
  create(@Body() createFloorDto: CreateFloorDto) {
    return this.floorService.create(createFloorDto);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard)
  @ApiOperation({ summary: 'Lấy danh sách tất cả các tầng (lọc theo buildingId)' })
  @ApiQuery({ name: 'buildingId', required: false, type: String })
  findAll(@Query('buildingId') buildingId?: string) {
    return this.floorService.findAll(buildingId);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard)
  @ApiOperation({ summary: 'Lấy thông tin chi tiết một tầng' })
  findOne(@Param('id') id: string) {
    return this.floorService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Cập nhật thông tin tầng (Admin)' })
  update(@Param('id') id: string, @Body() updateFloorDto: UpdateFloorDto) {
    return this.floorService.update(id, updateFloorDto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Xóa tầng (Admin)' })
  remove(@Param('id') id: string) {
    return this.floorService.remove(id);
  }
}
