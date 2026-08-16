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
import { ExamPackageService } from './exam-package.service';
import { CreateExamPackageDto } from './dto/create-exam-package.dto';
import { UpdateExamPackageDto } from './dto/update-exam-package.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { RoleTypeEnum } from '@prisma/client';
import { roles } from '../../shared/decorator/role.decorator';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { IsRoleGuard } from '../../shared/guards/is-role.guard';
import { orGuard } from '../../shared/guards/orGuards';
import { IsKioskGuard } from '../../shared/guards/is_kiosk.guard';

@ApiTags('Exam Package')
@Controller('exam-package')
export class ExamPackageController {
  constructor(private readonly examPackageService: ExamPackageService) {}

  @Post()
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @roles(RoleTypeEnum.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[ADMIN] Tạo gói khám mới' })
  create(@Body() createExamPackageDto: CreateExamPackageDto) {
    return this.examPackageService.create(createExamPackageDto);
  }

  @Get()
  @UseGuards(orGuard(IsAuthGuard, IsKioskGuard))
  @ApiBearerAuth()
  @ApiQuery({ name: 'is_active', required: false, type: Boolean })
  @ApiOperation({ summary: 'Lấy danh sách tất cả các gói khám' })
  findAll(@Query('is_active') is_active?: string) {
    const parsedIsActive =
      is_active === undefined ? undefined : is_active === 'true';
    return this.examPackageService.findAll({ is_active: parsedIsActive });
  }

  @Get(':id')
  @UseGuards(orGuard(IsAuthGuard, IsKioskGuard))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy chi tiết một gói khám' })
  findOne(@Param('id') id: string) {
    return this.examPackageService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @roles(RoleTypeEnum.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[ADMIN] Cập nhật thông tin gói khám' })
  update(
    @Param('id') id: string,
    @Body() updateExamPackageDto: UpdateExamPackageDto,
  ) {
    return this.examPackageService.update(id, updateExamPackageDto);
  }

  @Delete(':id')
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @roles(RoleTypeEnum.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[ADMIN] Vô hiệu hóa gói khám (409 nếu còn service order)',
  })
  remove(@Param('id') id: string) {
    return this.examPackageService.remove(id);
  }
}
