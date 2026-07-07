import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BuildingService } from './building.service';
import { CreateBuildingDto } from './dto/create-building.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { IsAdminGuard } from '../../shared/guards/is-admin.guard';

@ApiTags('Building')
@Controller('building')
export class BuildingController {
  constructor(private readonly buildingService: BuildingService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Tạo tòa nhà mới (Admin)' })
  create(@Body() createBuildingDto: CreateBuildingDto) {
    return this.buildingService.create(createBuildingDto);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard)
  @ApiOperation({ summary: 'Lấy danh sách tất cả tòa nhà' })
  findAll() {
    return this.buildingService.findAll();
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard)
  @ApiOperation({ summary: 'Lấy chi tiết một tòa nhà' })
  findOne(@Param('id') id: string) {
    return this.buildingService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Cập nhật thông tin tòa nhà (Admin)' })
  update(
    @Param('id') id: string,
    @Body() updateBuildingDto: UpdateBuildingDto,
  ) {
    return this.buildingService.update(id, updateBuildingDto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Xóa tòa nhà (Admin)' })
  remove(@Param('id') id: string) {
    return this.buildingService.remove(id);
  }
}
