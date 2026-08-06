import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
} from '@nestjs/common';
import { StaffService } from './staff.service';
import { CreateStaffReqDto, UpdateStaffReqDto } from './dto/req-staff.dto';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { IsRoleGuard } from '../../shared/guards/is-role.guard';
import { roles } from '../../shared/decorator/role.decorator';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { StaffResDto } from './dto/res-staff';
import { ResponseType } from '../../shared/types/response.type';

@Controller('staff')
@ApiBearerAuth()
@roles('ADMIN')
@UseGuards(IsAuthGuard, IsRoleGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post()
  @ApiOperation({ summary: '[ADMIN] Tạo mới nhân viên' })
  @ApiResponse({
    status: 201,
    schema: {
      example: {
        code: 200,
        status: 'success',
        message: 'Thành công',
        data: {
          staff_id: 'e99d34af-5e8a-471a-850c-7eb7cf4f6454',
          full_name: 'Nguyễn Văn An',
          license_number: 'VN-123456',
          experience_years: 5,
          specialty_id: '45a24967-567e-4b67-a0dc-0d73f2052a06',
          account: {
            account_id: 'e99d34af-5e8a-471a-850c-7eb7cf4f6454',
            avatar: 'https://example.com/avatar.jpg',
            user_name: 'NguyenAn',
            email: 'staff@example.com',
            role: 'DOCTOR',
            gender: 'MALE',
            phone: '0912345678',
            is_banned: false,
          },
        },
      },
    },
  })
  create(
    @Body() createStaffDto: CreateStaffReqDto,
  ): Promise<ResponseType<StaffResDto>> {
    return this.staffService.create(createStaffDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '[ADMIN] Cập nhật thông tin nhân viên theo ID' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        code: 200,
        status: 'success',
        message:
          'Cập nhật nhân viên với id e99d34af-5e8a-471a-850c-7eb7cf4f6454 thành công',
        data: {
          staff_id: 'e99d34af-5e8a-471a-850c-7eb7cf4f6454',
          full_name: 'Nguyễn Văn An',
          license_number: 'VN-123456',
          experience_years: 6,
          specialty_id: '45a24967-567e-4b67-a0dc-0d73f2052a06',
          account: {
            account_id: 'e99d34af-5e8a-471a-850c-7eb7cf4f6454',
            avatar: 'https://example.com/avatar.jpg',
            user_name: 'NguyenAnUpdate',
            email: 'staff@example.com',
            role: 'DOCTOR',
            gender: 'MALE',
            phone: '0912345678',
            is_banned: false,
          },
        },
      },
    },
  })
  update(
    @Param('id') id: string,
    @Body() updateStaffReqDto: UpdateStaffReqDto,
  ): Promise<ResponseType<StaffResDto>> {
    return this.staffService.update(id, updateStaffReqDto);
  }

  @Get()
  @roles('ADMIN', 'DOCTOR')
  @ApiOperation({ summary: '[ADMIN, DOCTOR] Lấy danh sách tất cả nhân viên' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        code: 200,
        status: 'success',
        message: 'Tìm tất cả nhân viên thành công',
        data: [
          {
            staff_id: 'e99d34af-5e8a-471a-850c-7eb7cf4f6454',
            full_name: 'Nguyễn Văn An',
            license_number: 'VN-123456',
            experience_years: 5,
            specialty_id: '45a24967-567e-4b67-a0dc-0d73f2052a06',
            account: {
              account_id: 'e99d34af-5e8a-471a-850c-7eb7cf4f6454',
              avatar: 'https://example.com/avatar.jpg',
              user_name: 'NguyenAn',
              email: 'staff@example.com',
              role: 'DOCTOR',
              gender: 'MALE',
              phone: '0912345678',
              is_banned: false,
            },
          },
        ],
      },
    },
  })
  findAll(): Promise<ResponseType<StaffResDto[]>> {
    return this.staffService.findAll();
  }

  @Get(':id')
  @roles('ADMIN', 'DOCTOR')
  @ApiOperation({
    summary: '[ADMIN, DOCTOR] Lấy thông tin chi tiết 1 nhân viên theo ID',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        code: 200,
        status: 'success',
        message:
          'Tìm nhân viên vơi id e99d34af-5e8a-471a-850c-7eb7cf4f6454 thành công',
        data: {
          staff_id: 'e99d34af-5e8a-471a-850c-7eb7cf4f6454',
          full_name: 'Nguyễn Văn An',
          license_number: 'VN-123456',
          experience_years: 5,
          specialty_id: '45a24967-567e-4b67-a0dc-0d73f2052a06',
          account: {
            account_id: 'e99d34af-5e8a-471a-850c-7eb7cf4f6454',
            avatar: 'https://example.com/avatar.jpg',
            user_name: 'NguyenAn',
            email: 'staff@example.com',
            role: 'DOCTOR',
            gender: 'MALE',
            phone: '0912345678',
            is_banned: false,
          },
        },
      },
    },
  })
  findOne(@Param('id') id: string): Promise<ResponseType<StaffResDto>> {
    return this.staffService.findOne(id);
  }
}
