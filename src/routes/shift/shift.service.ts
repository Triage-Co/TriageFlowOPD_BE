import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateShiftRequestDto,
  UpdateShiftRequestDto,
} from './dto/request-shift.dto';
import { PrismaService } from '../../shared/config/prisma.service';
import { Prisma, PrismaClient } from '@prisma/client';
import { formatInTimeZone, toDate } from 'date-fns-tz';

@Injectable()
export class ShiftService {
  private SHIFT: PrismaClient['shift'];
  SLOT: PrismaClient['slot'];
  STAFF: PrismaClient['staff'];
  ROOM: PrismaClient['room'];
  constructor(private readonly prismaService: PrismaService) {
    this.SHIFT = this.prismaService.shift;
    this.SLOT = this.prismaService.slot;
    this.STAFF = this.prismaService.staff;
    this.ROOM = this.prismaService.room;
  }

  private timeToMinutes = (timeStr: string) => {
    const [time, minute] = timeStr.split(':').map(Number);
    return time * 60 + minute;
  };

  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  async create(createShiftRequestDto: CreateShiftRequestDto) {
    const { date, end_time, room_id, staff_id, start_time } =
      createShiftRequestDto;

    try {
      const existedRoom = await this.ROOM.findUnique({
        where: {
          room_id: room_id,
        },
      });
      const existedStaff = await this.STAFF.findUnique({
        where: {
          staff_id: staff_id,
        },
      });

      if (!existedRoom) {
        throw new NotFoundException({
          message: 'không tìm thấy phòng',
          detail: `Không tìm thấy phòng với id ${room_id}`,
        });
      }

      if (!existedStaff) {
        throw new NotFoundException({
          message: 'không tìm thấy nhân viên',
          detail: `Không tìm thấy nhân viên với id ${staff_id}`,
        });
      }

      const conflictingShift = await this.SHIFT.findFirst({
        where: {
          staff_id: staff_id,
          date: date,
          start_time: {
            lt: end_time,
          },
          end_time: {
            gt: start_time,
          },
        },
      });

      if (conflictingShift) {
        if (conflictingShift.room_id !== room_id) {
          throw new ConflictException({
            message: 'Xung đột thời gian làm việc',
            detail: `Nhân viên (ID: ${staff_id}) đã có ca trực từ ${conflictingShift.start_time} đến ${conflictingShift.end_time} tại một phòng khác với id ${conflictingShift.room_id} trong ngày ${date}.`,
          });
        } else {
          throw new ConflictException({
            message: 'Lỗi trùng lặp dữ liệu',
            detail: `Ca trực từ ${start_time} - ${end_time} của nhân viên tại phòng này đã tồn tại hoặc bị trùng lặp thời gian với ca ${conflictingShift.start_time} - ${conflictingShift.end_time}.`,
          });
        }
      }

      const data = await this.prismaService.$transaction(async (tx) => {
        const existedStaffData = await tx.staff.findFirst({
          where: {
            staff_id: staff_id,
          },
        });

        // const sameRoomDataWithSpecialty = await tx.room.findFirst({
        //   where: {
        //     room_id: room_id,
        //     specialty_id: existedStaffData?.specialty_id
        //   }
        // })

        // if (!sameRoomDataWithSpecialty) {
        //   throw new ConflictException({
        //     message: "Không thể thêm bác sĩ vào phòng khác chuyên khoa",
        //     detail: "Không thể thêm bác sĩ vào phòng khác chuyên khoa"
        //   })
        // }

        if (!existedStaffData) {
          throw new NotFoundException({
            message: 'Không tìm thấy nhân viên',
            detail: 'Không tìm thấy nhân viên',
          });
        }

        const shift = await tx.shift.create({
          data: {
            staff_id: staff_id,
            room_id: room_id,
            date: date,
            start_time: start_time,
            end_time: end_time,
          },
        });

        const startMinutes = this.timeToMinutes(start_time);
        const endMinutes = this.timeToMinutes(end_time);
        const duration = endMinutes - startMinutes;
        const slotDuration = 30;
        const numSlots = Math.max(1, Math.floor(duration / slotDuration));
        const actualSlotDuration = numSlots === 1 ? duration : slotDuration;

        const slotsData: Prisma.SlotCreateManyInput[] = [];

        for (let i = 0; i < numSlots; i++) {
          const slotStart = startMinutes + i * actualSlotDuration;
          const slotEnd = slotStart + actualSlotDuration;
          slotsData.push({
            slot_index: i,
            shift_id: shift.shift_id,
            start_time: this.minutesToTime(slotStart),
            end_time: this.minutesToTime(slotEnd),
          });
        }

        return await tx.slot.createMany({
          data: slotsData,
        });
      });

      return {
        code: 200,
        message: 'Thêm ca trực thành công',
        status: 'success',
        data: data,
      };
    } catch (error) {
      throw error;
    }
  }

  async findAll() {
    try {
      const data = await this.SHIFT.findMany();

      if (!data) {
        throw new NotFoundException({
          message: 'Danh sách rỗng',
          datail: 'Không tìm thấy ca trực trong hệ thống',
        });
      }

      return {
        code: 200,
        message: 'Lấy danh sách ca trực thành công',
        status: 'success',
        data: data,
      };
    } catch (error) {
      throw error;
    }
  }

  async findOne(id: string) {
    try {
      const data = await this.SHIFT.findUnique({
        where: {
          shift_id: id,
        },
      });
      if (!data) {
        throw new NotFoundException({
          message: 'Danh sách rỗng',
          datail: `Không tìm thấy ca trực với id ${id}`,
        });
      }

      return {
        code: 200,
        message: `Lấy ca trực với id ${id} thành công`,
        status: 'success',
        data: data,
      };
    } catch (error) {
      throw error;
    }
  }

  // update(id: string, updateShiftRequestDto: UpdateShiftRequestDto) {
  //   return `This action updates a #${id} shift`;
  // }

  async remove(id: string) {
    try {
      const data = await this.SHIFT.findUnique({
        where: {
          shift_id: id,
        },
      });
      if (!data) {
        throw new NotFoundException({
          message: 'Danh sách rỗng',
          datail: `Không tìm thấy ca trực với id ${id}`,
        });
      }

      await this.SHIFT.delete({
        where: {
          shift_id: id,
        },
      });

      return {
        code: 200,
        message: `Xóa ca trực với id ${id} thành công`,
        status: 'success',
        data: data,
      };
    } catch (error) {
      throw error;
    }
  }

  async findMyShifts(staffId: string, dateStr?: string) {
    const timeZone = 'Asia/Ho_Chi_Minh';
    let targetDate = new Date();
    if (dateStr) {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        targetDate = parsed;
      }
    }

    const dateFormatted = formatInTimeZone(targetDate, timeZone, 'yyyy-MM-dd');
    const startOfDay = toDate(`${dateFormatted}T00:00:00`, { timeZone });
    const endOfDay = toDate(`${dateFormatted}T23:59:59.999`, { timeZone });

    const shifts = await this.SHIFT.findMany({
      where: {
        staff_id: staffId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        room: {
          include: {
            specialty: true,
          },
        },
      },
      orderBy: {
        start_time: 'asc',
      },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Lấy danh sách ca trực cá nhân thành công.',
      data: shifts,
    };
  }
}
