import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
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
  CreateAiSpecialtyDto,
  CreateAiSpecialtyMappingDto,
  QueryAiSpecialtyDto,
  UpdateAiSpecialtyDto,
  UpdateAiSpecialtyMappingDto,
} from './dto/ai-specialty.dto';
import { AiSpecialtyService } from './ai-specialty.service';

@ApiTags('AI Specialty')
@Controller('ai-specialty')
export class AiSpecialtyController {
  constructor(private readonly aiSpecialtyService: AiSpecialtyService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách AI specialty kèm mapping khoa BV' })
  findAll(@Query() query: QueryAiSpecialtyDto) {
    return this.aiSpecialtyService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết AI specialty' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.aiSpecialtyService.findOne(id);
  }

  @Post()
  @roles(RoleTypeEnum.ADMIN)
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[ADMIN] Tạo AI specialty' })
  create(@Body() dto: CreateAiSpecialtyDto) {
    return this.aiSpecialtyService.create(dto);
  }

  @Patch(':id')
  @roles(RoleTypeEnum.ADMIN)
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[ADMIN] Cập nhật AI specialty' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAiSpecialtyDto,
  ) {
    return this.aiSpecialtyService.update(id, dto);
  }

  @Delete(':id')
  @roles(RoleTypeEnum.ADMIN)
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[ADMIN] Soft-disable AI specialty (409 nếu còn mapping active)',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.aiSpecialtyService.remove(id);
  }

  @Get(':id/mappings')
  @ApiOperation({ summary: 'Danh sách mapping AI specialty → khoa bệnh viện' })
  findMappings(@Param('id', ParseUUIDPipe) id: string) {
    return this.aiSpecialtyService.findMappings(id);
  }

  @Post(':id/mappings')
  @roles(RoleTypeEnum.ADMIN)
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[ADMIN] Gắn khoa bệnh viện vào mã AI' })
  createMapping(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateAiSpecialtyMappingDto,
  ) {
    return this.aiSpecialtyService.createMapping(id, dto);
  }

  @Patch(':id/mappings/:mappingId')
  @roles(RoleTypeEnum.ADMIN)
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      '[ADMIN] Cập nhật mapping (đổi primary / thứ tự / active). Bỏ primary sẽ tự chọn mapping còn lại.',
  })
  updateMapping(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('mappingId', ParseUUIDPipe) mappingId: string,
    @Body() dto: UpdateAiSpecialtyMappingDto,
  ) {
    return this.aiSpecialtyService.updateMapping(id, mappingId, dto);
  }

  @Delete(':id/mappings/:mappingId')
  @roles(RoleTypeEnum.ADMIN)
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      '[ADMIN] Xóa mapping. Nếu đang primary, tự chọn mapping active còn lại làm primary.',
  })
  removeMapping(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('mappingId', ParseUUIDPipe) mappingId: string,
  ) {
    return this.aiSpecialtyService.removeMapping(id, mappingId);
  }
}
