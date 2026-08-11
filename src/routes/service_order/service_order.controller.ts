import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
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
  UpdateDetailReqDto,
} from './dto/req-service_order.dto';
import { roles } from '../../shared/decorator/role.decorator';
import { ApiBearerAuth } from '@nestjs/swagger';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { IsRoleGuard } from '../../shared/guards/is-role.guard';
@ApiTags('Service Order')
@Controller('service-order')
export class ServiceOrderController {
  constructor(private readonly serviceOrderService: ServiceOrderService) {}

  @Post()
  @roles("ADMIN", "DOCTOR")
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
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
    @Req() req: any,
    @Body()
    createServiceOrderReqDto: CreateServiceOrderReqDto,
  ) {
    const staffId =  req.user?.sub
    return this.serviceOrderService.create(createServiceOrderReqDto, staffId);
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

  @Get('/pending/:patientId')
  @ApiOperation({
    summary: 'Lấy danh sách Service Order chờ thanh toán theo bệnh nhân',
  })
  @ApiOkResponse({
    description: 'Lấy danh sách thành công.',
  })
  findPending(
    @Param('patientId')
    patientId: string,
  ) {
    return this.serviceOrderService.findPendingByPatientId(patientId);
  }

  @Get('booking/:bookingId')
  @roles('ADMIN', 'DOCTOR', 'NURSE', 'LAB_TECHNICIAN', 'PHARMACIST', 'RECEPTIONIST')
  @ApiOperation({
    summary: 'Lấy danh sách Service Order theo booking (chỉ Admin và Staff)',
  })
  @ApiOkResponse({
    description: 'Lấy danh sách thành công.',
  })
  findOrderServiceByBookingId(
    @Param('bookingId') bookingId: string,
  ) {
    return this.serviceOrderService.findOrderServiceByBookingId(bookingId);
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
    return this.serviceOrderService.update(id, updateServiceOrderReqDto);
  }

  @Patch('detail/:serviceOrderDetailId')
  @ApiOperation({
    summary: 'Cập nhật Service Order Detail',
  })
  @ApiOkResponse({
    description: 'Cập nhật Service Order Detail thành công.',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy Service Order Detail.',
  })
  @ApiBadRequestResponse({
    description: 'Lỗi cập nhật dữ liệu.',
  })
  updateDetail(
    @Param('serviceOrderDetailId')
    id: string,
    @Body()
    updateDto: UpdateDetailReqDto,
  ) {
    return this.serviceOrderService.updateDetail(id, updateDto);
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
