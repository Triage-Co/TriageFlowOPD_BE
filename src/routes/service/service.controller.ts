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
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RoleTypeEnum } from '@prisma/client';
import { roles } from '../../shared/decorator/role.decorator';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { IsRoleGuard } from '../../shared/guards/is-role.guard';
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
  @roles(RoleTypeEnum.ADMIN)
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
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
  @UseGuards(IsAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách dịch vụ (có phân trang)' })
  @ApiOkResponse({ description: 'Lấy danh sách dịch vụ thành công.' })
  findAll(@Query() query: QueryServiceReqDto) {
    return this.serviceService.findAll(query);
  }

  @Get(':id')
  @UseGuards(IsAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy thông tin chi tiết một dịch vụ' })
  @ApiOkResponse({ description: 'Lấy thông tin dịch vụ thành công.' })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy dịch vụ với ID tương ứng.',
  })
  findOne(@Param('id') id: string) {
    return this.serviceService.findOne(id);
  }

  @Patch(':id')
  @roles(RoleTypeEnum.ADMIN)
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật thông tin dịch vụ' })
  @ApiOkResponse({ description: 'Cập nhật dịch vụ thành công.' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy dịch vụ để cập nhật.' })
  @ApiConflictResponse({
    description: 'Mã dịch vụ muốn cập nhật đã tồn tại / còn tham chiếu.',
  })
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
  @roles(RoleTypeEnum.ADMIN)
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Vô hiệu hóa dịch vụ (soft-disable)' })
  @ApiOkResponse({ description: 'Vô hiệu hóa dịch vụ thành công.' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy dịch vụ để xóa.' })
  @ApiConflictResponse({
    description: 'Còn room_service hoặc service_order_detail.',
  })
  @ApiBadRequestResponse({ description: 'Lỗi hệ thống khi thực hiện xóa.' })
  remove(@Param('id') id: string) {
    return this.serviceService.remove(id);
  }
}
