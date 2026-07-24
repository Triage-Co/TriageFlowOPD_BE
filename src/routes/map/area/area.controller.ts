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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AreaService } from './area.service';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';
import { IsAuthGuard } from '../../../shared/guards/is-auth.guard';
import { IsRoleGuard } from '../../../shared/guards/is-role.guard';
import { roles } from '../../../shared/decorator/role.decorator';
import { RoleTypeEnum } from '@prisma/client';

@ApiTags('Area')
@Controller('area')
export class AreaController {
  constructor(private readonly areaService: AreaService) {}

  @Post()
  @ApiBearerAuth()
  @roles(RoleTypeEnum.ADMIN)
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiOperation({ summary: 'Tạo khu vực mới (Admin)' })
  create(@Body() createAreaDto: CreateAreaDto) {
    return this.areaService.create(createAreaDto);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard)
  @ApiOperation({ summary: 'Lấy danh sách khu vực (lọc theo floorId)' })
  @ApiQuery({ name: 'floorId', required: false, type: String })
  findAll(@Query('floorId') floorId?: string) {
    return this.areaService.findAll(floorId);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard)
  @ApiOperation({ summary: 'Lấy chi tiết một khu vực' })
  findOne(@Param('id') id: string) {
    return this.areaService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @roles(RoleTypeEnum.ADMIN)
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiOperation({ summary: 'Cập nhật khu vực (Admin)' })
  update(
    @Param('id') id: string,
    @Body() updateAreaDto: UpdateAreaDto,
  ) {
    return this.areaService.update(id, updateAreaDto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @roles(RoleTypeEnum.ADMIN)
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiOperation({ summary: 'Xóa khu vực (Admin)' })
  remove(@Param('id') id: string) {
    return this.areaService.remove(id);
  }
}
