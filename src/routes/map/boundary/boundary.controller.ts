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
import { BoundaryService } from './boundary.service';
import { CreateBoundaryDto } from './dto/create-boundary.dto';
import { UpdateBoundaryDto } from './dto/update-boundary.dto';
import { IsAuthGuard } from '../../../shared/guards/is-auth.guard';
import { IsRoleGuard } from '../../../shared/guards/is-role.guard';
import { RoleTypeEnum } from '@prisma/client';
import { roles } from '../../../shared/decorator/role.decorator';

@ApiTags('Boundary')
@Controller('boundary')
export class BoundaryController {
  constructor(private readonly boundaryService: BoundaryService) {}

  @Post()
  @ApiBearerAuth()
  @roles(RoleTypeEnum.ADMIN)
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiOperation({ summary: 'Tạo đường biên mới (Admin)' })
  create(@Body() createBoundaryDto: CreateBoundaryDto) {
    return this.boundaryService.create(createBoundaryDto);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard)
  @ApiOperation({
    summary:
      'Lấy danh sách đường biên (lọc theo floorId, roomId, areaId, standalone)',
  })
  @ApiQuery({ name: 'floorId', required: false, type: String })
  @ApiQuery({ name: 'roomId', required: false, type: String })
  @ApiQuery({ name: 'areaId', required: false, type: String })
  @ApiQuery({ name: 'standalone', required: false, type: Boolean })
  findAll(
    @Query('floorId') floorId?: string,
    @Query('roomId') roomId?: string,
    @Query('areaId') areaId?: string,
    @Query('standalone') standalone?: string,
  ) {
    return this.boundaryService.findAll({
      floorId,
      roomId,
      areaId,
      standalone: standalone === 'true',
    });
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard)
  @ApiOperation({ summary: 'Lấy thông tin chi tiết một đường biên' })
  findOne(@Param('id') id: string) {
    return this.boundaryService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @roles(RoleTypeEnum.ADMIN)
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiOperation({ summary: 'Cập nhật đường biên (Admin)' })
  update(
    @Param('id') id: string,
    @Body() updateBoundaryDto: UpdateBoundaryDto,
  ) {
    return this.boundaryService.update(id, updateBoundaryDto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @roles(RoleTypeEnum.ADMIN)
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiOperation({ summary: 'Xóa đường biên (Admin)' })
  remove(@Param('id') id: string) {
    return this.boundaryService.remove(id);
  }
}
