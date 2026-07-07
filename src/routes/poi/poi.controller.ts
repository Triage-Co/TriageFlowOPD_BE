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
import { PoiService } from './poi.service';
import { CreatePoiDto } from './dto/create-poi.dto';
import { UpdatePoiDto } from './dto/update-poi.dto';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { IsAdminGuard } from '../../shared/guards/is-admin.guard';

@ApiTags('Poi')
@Controller('poi')
export class PoiController {
  constructor(private readonly poiService: PoiService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Tạo POI mới (Admin)' })
  create(@Body() createPoiDto: CreatePoiDto) {
    return this.poiService.create(createPoiDto);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard)
  @ApiOperation({ summary: 'Lấy danh sách POI (lọc theo roomId hoặc categoryId)' })
  @ApiQuery({ name: 'roomId', required: false, type: String })
  @ApiQuery({ name: 'categoryId', required: false, type: String })
  findAll(
    @Query('roomId') roomId?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.poiService.findAll(roomId, categoryId);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard)
  @ApiOperation({ summary: 'Lấy chi tiết một POI' })
  findOne(@Param('id') id: string) {
    return this.poiService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Cập nhật POI (Admin)' })
  update(@Param('id') id: string, @Body() updatePoiDto: UpdatePoiDto) {
    return this.poiService.update(id, updatePoiDto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Xóa POI (Admin)' })
  remove(@Param('id') id: string) {
    return this.poiService.remove(id);
  }
}
