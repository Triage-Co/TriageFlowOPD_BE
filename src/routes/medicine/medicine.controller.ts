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
import { MedicineService } from './medicine.service';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { IsRoleGuard } from '../../shared/guards/is-role.guard';
import { roles } from '../../shared/decorator/role.decorator';

@ApiTags('Medicine')
@Controller('medicine')
export class MedicineController {
  constructor(private readonly medicineService: MedicineService) {}

  @Post()
  @roles('PHARMACIST', 'ADMIN', 'DOCTOR')
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[STAFF - ADMIN] Tạo loại thuốc mới',
    description: 'Endpoint dành cho Dược sĩ, Bác sĩ hoặc Quản trị viên khởi tạo thông tin loại thuốc mới vào danh mục.',
  })
  @ApiResponse({
    status: 201,
    description: 'Tạo thuốc mới thành công.',
    schema: {
      example: {
        medicine_id: 'f6a7b8c9-d0e1-2345-fabc-6789012345fa',
        medicine_code: 'MED-PAR-500',
        medicine_name: 'Paracetamol 500mg',
        active_ingredient: 'Paracetamol',
        unit: 'Viên',
        usage_route: 'Uống',
        unit_price: 5000,
        manufacturer: 'Dược Hậu Giang',
        description: 'Giảm đau, hạ sốt nhẹ đến vừa',
        is_active: true,
        created_at: '2026-07-30T13:00:00.000Z',
        updated_at: '2026-07-30T13:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu yêu cầu không hợp lệ.' })
  @ApiResponse({ status: 409, description: 'Mã thuốc đã tồn tại.' })
  create(@Body() createMedicineDto: CreateMedicineDto) {
    return this.medicineService.create(createMedicineDto);
  }

  @Get()
  @UseGuards(IsAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[ALL] Tra cứu danh sách thuốc',
    description: 'Endpoint hỗ trợ tìm kiếm thuốc theo tên, mã thuốc, hoạt chất và lọc theo trạng thái hoạt động.',
  })
  @ApiQuery({ name: 'search', required: false, description: 'Từ khóa tìm kiếm (tên, mã thuốc, hoạt chất)' })
  @ApiQuery({ name: 'is_active', required: false, type: Boolean, description: 'Lọc thuốc đang hoạt động' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Trang thứ bao nhiêu (mặc định 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Số bản ghi trên trang (mặc định 20)' })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách thuốc thành công.',
    schema: {
      example: {
        data: [
          {
            medicine_id: 'f6a7b8c9-d0e1-2345-fabc-6789012345fa',
            medicine_code: 'MED-PAR-500',
            medicine_name: 'Paracetamol 500mg',
            active_ingredient: 'Paracetamol',
            unit: 'Viên',
            usage_route: 'Uống',
            unit_price: 5000,
            manufacturer: 'Dược Hậu Giang',
            is_active: true,
          },
        ],
        meta: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      },
    },
  })
  findAll(
    @Query('search') search?: string,
    @Query('is_active') is_active?: boolean,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.medicineService.findAll({ search, is_active, page, limit });
  }

  @Get(':id')
  @UseGuards(IsAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[ALL] Lấy chi tiết thông tin loại thuốc',
    description: 'Endpoint lấy chi tiết 1 loại thuốc theo UUID.',
  })
  @ApiResponse({ status: 200, description: 'Lấy chi tiết thuốc thành công.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy loại thuốc.' })
  findOne(@Param('id') id: string) {
    return this.medicineService.findOne(id);
  }

  @Patch(':id')
  @roles('PHARMACIST', 'ADMIN')
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[PHARMACIST - ADMIN] Cập nhật thông tin loại thuốc',
    description: 'Endpoint cập nhật thông tin chi tiết loại thuốc.',
  })
  @ApiResponse({ status: 200, description: 'Cập nhật thuốc thành công.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy loại thuốc.' })
  update(@Param('id') id: string, @Body() updateMedicineDto: UpdateMedicineDto) {
    return this.medicineService.update(id, updateMedicineDto);
  }

  @Delete(':id')
  @roles('PHARMACIST', 'ADMIN')
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[PHARMACIST - ADMIN] Vô hiệu hóa (Soft delete) loại thuốc',
    description: 'Chuyển is_active về false để tạm ngừng kinh doanh/kê đơn loại thuốc này.',
  })
  @ApiResponse({ status: 200, description: 'Tạm ngừng loại thuốc thành công.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy loại thuốc.' })
  remove(@Param('id') id: string) {
    return this.medicineService.remove(id);
  }
}
