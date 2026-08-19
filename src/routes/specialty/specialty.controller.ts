import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleTypeEnum } from '@prisma/client';
import { roles } from '../../shared/decorator/role.decorator';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { IsRoleGuard } from '../../shared/guards/is-role.guard';
import {
  CreateSpecialtyDto,
  QuerySpecialtyDto,
  UpdateSpecialtyDto,
} from './dto/create-specialty.dto';
import { SpecialtyService } from './specialty.service';

@ApiTags('Specialty')
@Controller('specialty')
export class SpecialtyController {
  constructor(private readonly specialtyService: SpecialtyService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách chuyên khoa' })
  findAll(@Query() query: QuerySpecialtyDto) {
    return this.specialtyService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết chuyên khoa' })
  findOne(@Param('id') id: string) {
    return this.specialtyService.findOne(id);
  }

  @Post()
  @roles(RoleTypeEnum.ADMIN)
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo chuyên khoa' })
  create(@Body() dto: CreateSpecialtyDto) {
    return this.specialtyService.create(dto);
  }

  @Patch(':id')
  @roles(RoleTypeEnum.ADMIN)
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật chuyên khoa (PATCH is_active luôn được)' })
  update(@Param('id') id: string, @Body() dto: UpdateSpecialtyDto) {
    return this.specialtyService.update(id, dto);
  }

  @Delete(':id')
  @roles(RoleTypeEnum.ADMIN)
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Soft-disable chuyên khoa (409 nếu còn Room/Staff/Rule)',
  })
  remove(@Param('id') id: string) {
    return this.specialtyService.remove(id);
  }
}
