import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ExamPackageService } from './exam-package.service';
import { CreateExamPackageDto } from './dto/create-exam-package.dto';
import { UpdateExamPackageDto } from './dto/update-exam-package.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Exam Package')
@Controller('exam-package')
export class ExamPackageController {
  constructor(private readonly examPackageService: ExamPackageService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo gói khám mới' })
  create(@Body() createExamPackageDto: CreateExamPackageDto) {
    return this.examPackageService.create(createExamPackageDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả các gói khám' })
  findAll() {
    return this.examPackageService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết một gói khám' })
  findOne(@Param('id') id: string) {
    return this.examPackageService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin gói khám' })
  update(
    @Param('id') id: string,
    @Body() updateExamPackageDto: UpdateExamPackageDto,
  ) {
    return this.examPackageService.update(id, updateExamPackageDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa gói khám' })
  remove(@Param('id') id: string) {
    return this.examPackageService.remove(id);
  }
}
