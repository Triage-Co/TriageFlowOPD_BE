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
import { ClinicBoundaryService } from './clinic-boundary.service';
import { CreateClinicBoundaryDto } from './dto/create-clinic-boundary.dto';
import { UpdateClinicBoundaryDto } from './dto/update-clinic-boundary.dto';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { IsRoleGuard } from '../../shared/guards/is-role.guard';
import { RoleTypeEnum } from '@prisma/client';
import { roles } from '../../shared/decorator/role.decorator';

@ApiTags('ClinicBoundary')
@Controller('clinic-boundary')
export class ClinicBoundaryController {
  constructor(private readonly clinicBoundaryService: ClinicBoundaryService) {}

  @Post()
  @ApiBearerAuth()
  @roles(RoleTypeEnum.ADMIN)
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiOperation({ summary: 'Tạo đường biên khu khám mới (Admin)' })
  create(@Body() createClinicBoundaryDto: CreateClinicBoundaryDto) {
    return this.clinicBoundaryService.create(createClinicBoundaryDto);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard)
  @ApiOperation({ summary: 'Lấy danh sách đường biên khu khám (lọc theo clinicId)' })
  @ApiQuery({ name: 'clinicId', required: false, type: String })
  findAll(@Query('clinicId') clinicId?: string) {
    return this.clinicBoundaryService.findAll(clinicId);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard)
  @ApiOperation({ summary: 'Lấy thông tin chi tiết một đường biên khu khám' })
  findOne(@Param('id') id: string) {
    return this.clinicBoundaryService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @roles(RoleTypeEnum.ADMIN)
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiOperation({ summary: 'Cập nhật đường biên khu khám (Admin)' })
  update(
    @Param('id') id: string,
    @Body() updateClinicBoundaryDto: UpdateClinicBoundaryDto,
  ) {
    return this.clinicBoundaryService.update(id, updateClinicBoundaryDto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @roles(RoleTypeEnum.ADMIN)
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiOperation({ summary: 'Xóa đường biên khu khám (Admin)' })
  remove(@Param('id') id: string) {
    return this.clinicBoundaryService.remove(id);
  }
}
