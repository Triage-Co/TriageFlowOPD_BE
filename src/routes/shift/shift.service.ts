import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateShiftDto, UpdateShiftDto } from './dto/request-shift.dto';
import { PrismaConfig } from '../../shared/config/prisma.config';

@Injectable()
export class ShiftService {
  constructor(private readonly pismaClient: PrismaConfig) {}

  async create(createShiftDto: CreateShiftDto) {
    try {
      const exitedShift = await this.pismaClient.shift.findUnique({
        where: {
          doctorId_date_startTime_endTime: {
            doctorId: createShiftDto.doctorId,
            date: createShiftDto.date,
            startTime: createShiftDto.startTime,
            endTime: createShiftDto.endTime,
          },
        },
      });
      if (exitedShift) {
        return {
          code: 404,
          message: `Ca trực ${createShiftDto.startTime} - ${createShiftDto.endTime} của bác sĩ với id ${createShiftDto.doctorId} đã tồn tại trong hệ thống`,
          status: 'error',
        };
      }

      const data = await this.pismaClient.shift.create({
        data: {
          doctorId: createShiftDto.doctorId,
          date: createShiftDto.date,
          startTime: createShiftDto.startTime,
          endTime: createShiftDto.endTime,
          capacity: createShiftDto.capacity,
        },
      });
      return {
        code: 200,
        message: 'Thêm ca trực thành công',
        status: 'success',
        data: data,
      };
    } catch (error) {
      return {
        code: 500,
        message: error,
        status: 'error',
      };
    }
  }

  async findAll() {
    try {
      const data = await this.pismaClient.shift.findMany({
        select: {
          id: true,
          date: true,
          startTime: true,
          endTime: true,
          capacity: true,
          doctors: {
            select: {
              id: true,
              specialty: {
                select: {
                  name: true,
                },
              },
              doctor: {
                select: {
                  full_name: true,
                },
              },
            },
          },
          status: true,
        },
      });
      if (!data) {
        throw new BadRequestException('Danh sách ca trực rỗng');
      }
      return {
        code: 200,
        message: 'Lấy toàn bộ ca trực thành công',
        status: 'success',
        data: data,
      };
    } catch (error) {
      return {
        code: 500,
        message: error instanceof Error ? error.message : 'Unknown Error',
        status: 'error',
      };
    }
  }

  async findOne(id: string) {
    try {
      const data = await this.pismaClient.shift.findFirst({
        where: {
          id: id,
        },
        select: {
          id: true,
          date: true,
          startTime: true,
          endTime: true,
          capacity: true,
          doctors: {
            select: {
              id: true,
              specialty: {
                select: {
                  name: true,
                },
              },
              doctor: {
                select: {
                  id: true,
                  full_name: true,
                  citizen_id: true,
                  dob: true,
                  email: true,
                  gender: true,
                },
              },
            },
          },
          status: true,
        },
      });
      if (!data) {
        throw new BadRequestException('Danh sách ca trực rỗng');
      }
      return {
        code: 200,
        message: 'Lấy toàn bộ ca trực thành công',
        status: 'success',
        data: data,
      };
    } catch (error) {
      return {
        code: 500,
        message: error instanceof Error ? error.message : 'Unknown Error',
        status: 'error',
      };
    }
  }

  async update(id: string, updateShiftDto: UpdateShiftDto) {
    try {
      const data = await this.pismaClient.shift.update({
        data: {
          doctorId: updateShiftDto.doctorId,
          date: updateShiftDto.date,
          startTime: updateShiftDto.startTime,
          endTime: updateShiftDto.endTime,
          capacity: updateShiftDto.capacity,
        },
        where: {
          id: id,
        },
      });
      return {
        code: 200,
        message: 'Thêm ca trực thành công',
        status: 'success',
        data: data,
      };
    } catch (error) {
      return {
        code: 500,
        message: error instanceof Error ? error.message : 'Unknown Error',
        status: 'error',
      };
    }
  }
}
