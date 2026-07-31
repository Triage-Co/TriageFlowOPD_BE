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
import { BulkCreateMedicineDto, CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsAuthGuard } from '../../../shared/guards/is-auth.guard';
import { IsRoleGuard } from '../../../shared/guards/is-role.guard';
import { roles } from '../../../shared/decorator/role.decorator';

@ApiTags('Medicine')
@Controller('medicine')
export class MedicineController {
  constructor(private readonly medicineService: MedicineService) {}

  @Post('seed')
  @roles('ADMIN', 'PHARMACIST')
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[ADMIN - PHARMACIST] Seed danh mục 20 loại thuốc OPD phổ biến',
    description: 'Tự động chèn/cập nhật 20 loại thuốc thông dụng tại Việt Nam (Paracetamol, Amoxicillin, Augmentin, Ibuprofen, Omeprazole, Smecta, Berberin, Panadol...) vào cơ sở dữ liệu.',
  })
  @ApiResponse({ status: 201, description: 'Seed danh mục thuốc thành công.' })
  seedMedicines() {
    return this.medicineService.seedMedicines();
  }

  @Post('bulk')
  @roles('PHARMACIST', 'ADMIN')
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[PHARMACIST - ADMIN] Tạo/Khởi tạo hàng loạt loại thuốc',
    description: 'Endpoint nhận vào mảng danh sách thuốc để chèn hàng loạt vào DB.',
  })
  @ApiResponse({ status: 201, description: 'Tạo hàng loạt thuốc thành công.' })
  bulkCreate(@Body() bulkDto: BulkCreateMedicineDto) {
    return this.medicineService.bulkCreate(bulkDto);
  }

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

  @Get('routes')
  @UseGuards(IsAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[ALL] Lấy danh sách các đường dùng thuốc (Dropdown FE)',
    description: 'Trả về mảng danh sách các đường dùng thuốc độc nhất (VD: Uống, Tiêm, Bôi, Ngậm...) phục vụ bộ lọc FE.',
  })
  @ApiResponse({ status: 200, description: 'Lấy danh sách đường dùng thành công.' })
  getRoutes() {
    return this.medicineService.getRoutes();
  }

  @Get('active-ingredients')
  @UseGuards(IsAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[ALL] Lấy danh sách các hoạt chất thuốc (Dropdown FE)',
    description: 'Trả về mảng danh sách các hoạt chất thuốc độc nhất phục vụ bộ lọc FE.',
  })
  @ApiResponse({ status: 200, description: 'Lấy danh sách hoạt chất thành công.' })
  getActiveIngredients() {
    return this.medicineService.getActiveIngredients();
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

  @Patch(':id/restore')
  @roles('PHARMACIST', 'ADMIN')
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[PHARMACIST - ADMIN] Khôi phục loại thuốc đã vô hiệu hóa',
    description: 'Chuyển is_active về true để tiếp tục sử dụng/kê đơn loại thuốc này.',
  })
  @ApiResponse({ status: 200, description: 'Khôi phục loại thuốc thành công.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy loại thuốc.' })
  restore(@Param('id') id: string) {
    return this.medicineService.restore(id);
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
