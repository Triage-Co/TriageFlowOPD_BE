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
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';

import { ServiceOrderService } from './service_order.service';
import {
  CreateServiceOrderReqDto,
  UpdateServiceOrderReqDto,
  QueryServiceOrderReqDto,
} from './dto/req-service_order.dto';

@ApiTags('Service Order')
@Controller('service-order')
export class ServiceOrderController {
  constructor(
    private readonly serviceOrderService: ServiceOrderService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Tạo mới Service Order',
  })
  @ApiCreatedResponse({
    description: 'Tạo Service Order thành công.',
  })
  @ApiBadRequestResponse({
    description: 'Dữ liệu không hợp lệ hoặc lỗi hệ thống.',
  })
  create(
    @Body()
    createServiceOrderReqDto: CreateServiceOrderReqDto,
  ) {
    return this.serviceOrderService.create(
      createServiceOrderReqDto,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách Service Order',
  })
  @ApiOkResponse({
    description: 'Lấy danh sách Service Order thành công.',
  })
  findAll(
    @Query()
    query: QueryServiceOrderReqDto,
  ) {
    return this.serviceOrderService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Lấy chi tiết Service Order',
  })
  @ApiOkResponse({
    description: 'Lấy thông tin Service Order thành công.',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy Service Order.',
  })
  findOne(
    @Param('id')
    id: string,
  ) {
    return this.serviceOrderService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Cập nhật Service Order',
  })
  @ApiOkResponse({
    description: 'Cập nhật Service Order thành công.',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy Service Order.',
  })
  @ApiBadRequestResponse({
    description: 'Lỗi cập nhật dữ liệu.',
  })
  update(
    @Param('id')
    id: string,

    @Body()
    updateServiceOrderReqDto: UpdateServiceOrderReqDto,
  ) {
    return this.serviceOrderService.update(
      id,
      updateServiceOrderReqDto,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Xóa Service Order',
  })
  @ApiOkResponse({
    description: 'Xóa Service Order thành công.',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy Service Order.',
  })
  @ApiBadRequestResponse({
    description: 'Lỗi hệ thống.',
  })
  remove(
    @Param('id')
    id: string,
  ) {
    return this.serviceOrderService.remove(id);
  }
}
