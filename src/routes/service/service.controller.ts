import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { ServiceService } from './service.service';
import {
  CreateServiceReqDto,
  UpdateServiceReqDto,
  QueryServiceReqDto,
} from './dto/req-service.dto';

@ApiTags('Service')
@Controller('service')
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo mới một dịch vụ' })
  @ApiCreatedResponse({ description: 'Tạo dịch vụ mới thành công.' })
  @ApiConflictResponse({ description: 'Mã dịch vụ đã tồn tại trong hệ thống.' })
  @ApiBadRequestResponse({
    description: 'Dữ liệu đầu vào không hợp lệ hoặc lỗi hệ thống.',
  })
  create(@Body() createServiceReqDto: CreateServiceReqDto) {
    return this.serviceService.create(createServiceReqDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách dịch vụ (có phân trang)' })
  @ApiOkResponse({ description: 'Lấy danh sách dịch vụ thành công.' })
  findAll(@Query() query: QueryServiceReqDto) {
    return this.serviceService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết một dịch vụ' })
  @ApiOkResponse({ description: 'Lấy thông tin dịch vụ thành công.' })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy dịch vụ với ID tương ứng.',
  })
  findOne(@Param('id') id: string) {
    return this.serviceService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin dịch vụ' })
  @ApiOkResponse({ description: 'Cập nhật dịch vụ thành công.' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy dịch vụ để cập nhật.' })
  @ApiConflictResponse({ description: 'Mã dịch vụ muốn cập nhật đã tồn tại.' })
  @ApiBadRequestResponse({
    description: 'Dữ liệu đầu vào không hợp lệ hoặc lỗi hệ thống.',
  })
  update(
    @Param('id') id: string,
    @Body() updateServiceReqDto: UpdateServiceReqDto,
  ) {
    return this.serviceService.update(id, updateServiceReqDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa một dịch vụ' })
  @ApiOkResponse({ description: 'Xóa dịch vụ thành công.' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy dịch vụ để xóa.' })
  @ApiBadRequestResponse({ description: 'Lỗi hệ thống khi thực hiện xóa.' })
  remove(@Param('id') id: string) {
    return this.serviceService.remove(id);
  }
}
