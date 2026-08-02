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

import { ServiceOrderDetailService } from './service_order_detail.service';

import {
  CreateServiceOrderDetailReqDto,
  UpdateServiceOrderDetailReqDto,
  QueryServiceOrderDetailReqDto,
} from './dto/req-service_order_detail.dto';

@ApiTags('Service Order Detail')
@Controller('service-order-detail')
export class ServiceOrderDetailController {
  constructor(
    private readonly serviceOrderDetailService: ServiceOrderDetailService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Tạo mới chi tiết Service Order',
  })
  @ApiCreatedResponse({
    description: 'Tạo Service Order Detail thành công.',
  })
  @ApiBadRequestResponse({
    description: 'Dữ liệu không hợp lệ hoặc lỗi hệ thống.',
  })
  create(
    @Body()
    createDto: CreateServiceOrderDetailReqDto,
  ) {
    return this.serviceOrderDetailService.create(createDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách chi tiết Service Order',
  })
  @ApiOkResponse({
    description: 'Lấy danh sách Service Order Detail thành công.',
  })
  findAll(
    @Query()
    query: QueryServiceOrderDetailReqDto,
  ) {
    return this.serviceOrderDetailService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Lấy thông tin chi tiết Service Order Detail',
  })
  @ApiOkResponse({
    description: 'Lấy thông tin thành công.',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy Service Order Detail.',
  })
  findOne(
    @Param('id')
    id: string,
  ) {
    return this.serviceOrderDetailService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Cập nhật Service Order Detail',
  })
  @ApiOkResponse({
    description: 'Cập nhật thành công.',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy Service Order Detail.',
  })
  @ApiBadRequestResponse({
    description: 'Dữ liệu cập nhật không hợp lệ.',
  })
  update(
    @Param('id')
    id: string,

    @Body()
    updateDto: UpdateServiceOrderDetailReqDto,
  ) {
    return this.serviceOrderDetailService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Xóa Service Order Detail',
  })
  @ApiOkResponse({
    description: 'Xóa thành công.',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy Service Order Detail.',
  })
  @ApiBadRequestResponse({
    description: 'Lỗi khi thực hiện xóa.',
  })
  remove(
    @Param('id')
    id: string,
  ) {
    return this.serviceOrderDetailService.remove(id);
  }
}
