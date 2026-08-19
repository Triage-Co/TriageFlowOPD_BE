import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import {
  CreateShiftRequestDto,
  QueryShiftDto,
  UpdateShiftRequestDto,
} from './dto/request-shift.dto';
import { BulkWeeklyShiftDto } from './dto/bulk-weekly-shift.dto';
import { BulkImportShiftDto } from './dto/bulk-import-shift.dto';
import { PrismaService } from '../../shared/config/prisma.service';
import type { IShiftRepository } from '../../shared/interfaces/i-shift.repository';
import { Prisma, PrismaClient, RoleTypeEnum } from '@prisma/client';
import { formatInTimeZone, toDate } from 'date-fns-tz';

const TIME_ZONE = 'Asia/Ho_Chi_Minh';

@Injectable()
export class ShiftService {
  private SHIFT: PrismaClient['shift'];
  SLOT: PrismaClient['slot'];
  STAFF: PrismaClient['staff'];
  ROOM: PrismaClient['room'];
  constructor(
    private readonly prismaService: PrismaService,
    @Inject('IShiftRepository') private readonly shiftRepository: IShiftRepository,
  ) {
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

  private buildSlotsData(
    shiftId: string,
    startTime: string,
    endTime: string,
  ): Prisma.SlotCreateManyInput[] {
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);
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
        shift_id: shiftId,
        start_time: this.minutesToTime(slotStart),
        end_time: this.minutesToTime(slotEnd),
      });
    }
    return slotsData;
  }

  /** Nếu phòng gắn chuyên khoa và nhân viên là DOCTOR, chuyên khoa phải khớp. */
  private assertDoctorSpecialtyMatches(
    room: { room_id: string; specialty_id: string | null },
    staff: { staff_id: string; specialty_id: string | null; account?: { role: RoleTypeEnum } | null },
  ) {
    if (!room.specialty_id) return;
    if (staff.account?.role !== RoleTypeEnum.DOCTOR) return;

    if (staff.specialty_id !== room.specialty_id) {
      throw new ConflictException({
        message: 'Không thể thêm bác sĩ vào phòng khác chuyên khoa',
        detail: `Phòng (ID: ${room.room_id}) thuộc chuyên khoa ${room.specialty_id}, nhân viên (ID: ${staff.staff_id}) thuộc chuyên khoa ${staff.specialty_id ?? 'không có'}.`,
      });
    }
  }

  private async findConflictingShift(
    staffId: string,
    startOfDay: Date,
    endOfDay: Date,
    startTime: string,
    endTime: string,
    excludeShiftId?: string,
  ) {
    return this.SHIFT.findFirst({
      where: {
        staff_id: staffId,
        ...(excludeShiftId ? { shift_id: { not: excludeShiftId } } : {}),
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        start_time: {
          lt: endTime,
        },
        end_time: {
          gt: startTime,
        },
      },
    });
  }

  private throwConflictShiftError(
    conflictingShift: { room_id: string; start_time: string; end_time: string },
    staffId: string,
    roomId: string,
    dateFormatted: string,
  ): never {
    if (conflictingShift.room_id !== roomId) {
      throw new ConflictException({
        message: 'Xung đột thời gian làm việc',
        detail: `Nhân viên (ID: ${staffId}) đã có ca trực từ ${conflictingShift.start_time} đến ${conflictingShift.end_time} tại một phòng khác với id ${conflictingShift.room_id} trong ngày ${dateFormatted}.`,
      });
    }
    throw new ConflictException({
      message: 'Lỗi trùng lặp dữ liệu',
      detail: `Ca trực từ ${conflictingShift.start_time} - ${conflictingShift.end_time} của nhân viên tại phòng này đã tồn tại hoặc bị trùng lặp thời gian.`,
    });
  }

  async create(createShiftRequestDto: CreateShiftRequestDto) {
    const { date, end_time, room_id, staff_id, start_time } =
      createShiftRequestDto;

    try {
      const dateFormatted = formatInTimeZone(date, TIME_ZONE, 'yyyy-MM-dd');
      const startOfDay = toDate(`${dateFormatted}T00:00:00`, { timeZone: TIME_ZONE });
      const endOfDay = toDate(`${dateFormatted}T23:59:59.999`, { timeZone: TIME_ZONE });

      const existedRoom = await this.ROOM.findUnique({
        where: { room_id },
      });
      const existedStaff = await this.STAFF.findUnique({
        where: { staff_id },
        include: { account: true },
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

      this.assertDoctorSpecialtyMatches(existedRoom, existedStaff);

      const conflictingShift = await this.findConflictingShift(
        staff_id,
        startOfDay,
        endOfDay,
        start_time,
        end_time,
      );

      if (conflictingShift) {
        this.throwConflictShiftError(conflictingShift, staff_id, room_id, dateFormatted);
      }

      const data = await this.prismaService.$transaction(async (tx) => {
        const shift = await tx.shift.create({
          data: {
            staff_id: staff_id,
            room_id: room_id,
            date: startOfDay,
            start_time: start_time,
            end_time: end_time,
          },
        });

        const slotsData = this.buildSlotsData(shift.shift_id, start_time, end_time);

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

  private toDayBounds(dateStr: string) {
    if (!this.isValidDateString(dateStr)) {
      throw new BadRequestException({
        message: 'Ngày không hợp lệ',
        detail: `${dateStr} phải là ngày tồn tại theo định dạng yyyy-MM-dd.`,
      });
    }
    return {
      start: toDate(`${dateStr}T00:00:00`, { timeZone: TIME_ZONE }),
      end: toDate(`${dateStr}T23:59:59.999`, { timeZone: TIME_ZONE }),
    };
  }

  private buildFindAllWhere(query: QueryShiftDto): Prisma.ShiftWhereInput {
    const where: Prisma.ShiftWhereInput = {};
    if (query.room_id) where.room_id = query.room_id;
    if (query.staff_id) where.staff_id = query.staff_id;

    if (query.date) {
      const { start, end } = this.toDayBounds(query.date);
      where.date = { gte: start, lte: end };
      return where;
    }

    if (query.from || query.to) {
      if (query.from && query.to && query.from > query.to) {
        throw new BadRequestException({
          message: 'Khoảng ngày không hợp lệ',
          detail: 'from phải nhỏ hơn hoặc bằng to.',
        });
      }
      const dateFilter: Prisma.DateTimeFilter = {};
      if (query.from) dateFilter.gte = this.toDayBounds(query.from).start;
      if (query.to) dateFilter.lte = this.toDayBounds(query.to).end;
      where.date = dateFilter;
      return where;
    }

    const today = formatInTimeZone(new Date(), TIME_ZONE, 'yyyy-MM-dd');
    const { start, end } = this.toDayBounds(today);
    where.date = { gte: start, lte: end };
    return where;
  }

  async findAll(query: QueryShiftDto = {}) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = Math.min(query.limit && query.limit > 0 ? query.limit : 100, 500);
    const skip = (page - 1) * limit;
    const where = this.buildFindAllWhere(query);

    const [data, total] = await Promise.all([
      this.SHIFT.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ date: 'asc' }, { start_time: 'asc' }],
        select: {
          shift_id: true,
          staff_id: true,
          room_id: true,
          date: true,
          start_time: true,
          end_time: true,
          createdAt: true,
          updatedAt: true,
          physicalRoomId: true,
          room: {
            select: {
              room_id: true,
              room_name: true,
              room_type: true,
              specialty_id: true,
              physical_room_id: true,
              specialty: {
                select: {
                  specialty_id: true,
                  specialty_name: true,
                  specialty_code: true,
                },
              },
            },
          },
          staff: {
            select: {
              staff_id: true,
              full_name: true,
            },
          },
        },
      }),
      this.SHIFT.count({ where }),
    ]);

    const formattedData = data.map((shift) => ({
      ...shift,
      date: formatInTimeZone(shift.date, TIME_ZONE, 'yyyy-MM-dd'),
      staff_name: shift.staff?.full_name ?? null,
    }));

    return {
      code: 200,
      message: 'Lấy danh sách ca trực thành công',
      status: 'success',
      data: formattedData,
      meta: { total, page, limit },
    };
  }

  async findOne(id: string) {
    try {
      const data = await this.SHIFT.findUnique({
        where: {
          shift_id: id,
        },
        include: {
          room: {
            include: {
              specialty: true,
            },
          },
        },
      });
      if (!data) {
        throw new NotFoundException({
          message: 'Danh sách rỗng',
          datail: `Không tìm thấy ca trực với id ${id}`,
        });
      }

      const formattedData = {
        ...data,
        date: formatInTimeZone(data.date, TIME_ZONE, 'yyyy-MM-dd'),
      };

      return {
        code: 200,
        message: `Lấy ca trực với id ${id} thành công`,
        status: 'success',
        data: formattedData,
      };
    } catch (error) {
      throw error;
    }
  }

  async update(id: string, updateShiftRequestDto: UpdateShiftRequestDto) {
    const existing = await this.SHIFT.findUnique({ where: { shift_id: id } });
    if (!existing) {
      throw new NotFoundException({
        message: 'Không tìm thấy ca trực',
        detail: `Không tìm thấy ca trực với id ${id}`,
      });
    }

    const staff_id = updateShiftRequestDto.staff_id ?? existing.staff_id;
    const room_id = updateShiftRequestDto.room_id ?? existing.room_id;
    const start_time = updateShiftRequestDto.start_time ?? existing.start_time;
    const end_time = updateShiftRequestDto.end_time ?? existing.end_time;
    const date = updateShiftRequestDto.date ?? existing.date;

    const dateFormatted = formatInTimeZone(date, TIME_ZONE, 'yyyy-MM-dd');
    const startOfDay = toDate(`${dateFormatted}T00:00:00`, { timeZone: TIME_ZONE });
    const endOfDay = toDate(`${dateFormatted}T23:59:59.999`, { timeZone: TIME_ZONE });

    const existedRoom = await this.ROOM.findUnique({ where: { room_id } });
    if (!existedRoom) {
      throw new NotFoundException({
        message: 'không tìm thấy phòng',
        detail: `Không tìm thấy phòng với id ${room_id}`,
      });
    }

    const existedStaff = await this.STAFF.findUnique({
      where: { staff_id },
      include: { account: true },
    });
    if (!existedStaff) {
      throw new NotFoundException({
        message: 'không tìm thấy nhân viên',
        detail: `Không tìm thấy nhân viên với id ${staff_id}`,
      });
    }

    this.assertDoctorSpecialtyMatches(existedRoom, existedStaff);

    const conflictingShift = await this.findConflictingShift(
      staff_id,
      startOfDay,
      endOfDay,
      start_time,
      end_time,
      id,
    );

    if (conflictingShift) {
      this.throwConflictShiftError(conflictingShift, staff_id, room_id, dateFormatted);
    }

    const existingDateFormatted = formatInTimeZone(existing.date, TIME_ZONE, 'yyyy-MM-dd');
    const timeOrDateChanged =
      start_time !== existing.start_time ||
      end_time !== existing.end_time ||
      dateFormatted !== existingDateFormatted;

    const data = await this.prismaService.$transaction(async (tx) => {
      const updatedShift = await tx.shift.update({
        where: { shift_id: id },
        data: {
          staff_id,
          room_id,
          date: startOfDay,
          start_time,
          end_time,
        },
      });

      if (timeOrDateChanged) {
        await tx.slot.deleteMany({ where: { shift_id: id } });
        const slotsData = this.buildSlotsData(id, start_time, end_time);
        await tx.slot.createMany({ data: slotsData });
      }

      return updatedShift;
    });

    return {
      code: 200,
      message: `Cập nhật ca trực với id ${id} thành công`,
      status: 'success',
      data: {
        ...data,
        date: formatInTimeZone(data.date, TIME_ZONE, 'yyyy-MM-dd'),
      },
    };
  }

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
    let targetDate = new Date();
    if (dateStr) {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        targetDate = parsed;
      }
    }

    const dateFormatted = formatInTimeZone(targetDate, TIME_ZONE, 'yyyy-MM-dd');
    const startOfDay = toDate(`${dateFormatted}T00:00:00`, { timeZone: TIME_ZONE });
    const endOfDay = toDate(`${dateFormatted}T23:59:59.999`, { timeZone: TIME_ZONE });

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

    const formattedShifts = shifts.map((shift) => ({
      ...shift,
      date: formatInTimeZone(shift.date, TIME_ZONE, 'yyyy-MM-dd'),
    }));

    return {
      code: 200,
      status: 'success',
      message: 'Lấy danh sách ca trực cá nhân thành công.',
      data: formattedShifts,
    };
  }

  /** yyyy-MM-dd → true nếu ngày tồn tại trên lịch. */
  private isValidDateString(dateStr: string): boolean {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (!match) return false;
    const [, y, m, d] = match;
    const dateObj = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    return (
      dateObj.getUTCFullYear() === Number(y) &&
      dateObj.getUTCMonth() === Number(m) - 1 &&
      dateObj.getUTCDate() === Number(d)
    );
  }

  /** yyyy-MM-dd → true nếu là Thứ 2 (Monday), tính theo lịch (không phụ thuộc TZ vì không có phần giờ). */
  private isMondayDateString(dateStr: string): boolean {
    if (!this.isValidDateString(dateStr)) return false;
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    return dateObj.getUTCDay() === 1; // 1 = Monday
  }

  private addDaysToDateString(dateStr: string, days: number): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    dateObj.setUTCDate(dateObj.getUTCDate() + days);
    return formatInTimeZone(dateObj, 'UTC', 'yyyy-MM-dd');
  }

  private classifyBulkError(error: unknown): string {
    if (error instanceof ConflictException) return 'CONFLICT';
    if (error instanceof NotFoundException) return 'NOT_FOUND';
    if (error instanceof BadRequestException) return 'BAD_REQUEST';
    const message = (error as { message?: string })?.message;
    return message ?? 'ERROR';
  }

  /** Tạo 1 ca + slot; throw Conflict/NotFound/BadRequest nếu không hợp lệ. */
  private async createShiftWithSlots(params: {
    room_id: string;
    staff_id: string;
    dateStr: string;
    start_time: string;
    end_time: string;
  }) {
    const { room_id, staff_id, dateStr, start_time, end_time } = params;

    if (!this.isValidDateString(dateStr)) {
      throw new BadRequestException({
        message: 'date không hợp lệ',
        detail: `date (${dateStr}) phải là ngày tồn tại theo định dạng yyyy-MM-dd.`,
      });
    }

    if (this.timeToMinutes(end_time) <= this.timeToMinutes(start_time)) {
      throw new BadRequestException({
        message: 'Khoảng thời gian không hợp lệ',
        detail: 'end_time phải lớn hơn start_time.',
      });
    }

    const startOfDay = toDate(`${dateStr}T00:00:00`, { timeZone: TIME_ZONE });
    const endOfDay = toDate(`${dateStr}T23:59:59.999`, { timeZone: TIME_ZONE });

    const existedRoom = await this.ROOM.findUnique({ where: { room_id } });
    if (!existedRoom) {
      throw new NotFoundException(`Không tìm thấy phòng với id ${room_id}`);
    }

    const existedStaff = await this.STAFF.findUnique({
      where: { staff_id },
      include: { account: true },
    });
    if (!existedStaff) {
      throw new NotFoundException(`Không tìm thấy nhân viên với id ${staff_id}`);
    }

    this.assertDoctorSpecialtyMatches(existedRoom, existedStaff);

    const conflictingShift = await this.findConflictingShift(
      staff_id,
      startOfDay,
      endOfDay,
      start_time,
      end_time,
    );

    if (conflictingShift) {
      throw new ConflictException('CONFLICT');
    }

    return this.prismaService.$transaction(async (tx) => {
      const shift = await tx.shift.create({
        data: {
          staff_id,
          room_id,
          date: startOfDay,
          start_time,
          end_time,
        },
      });

      const slotsData = this.buildSlotsData(shift.shift_id, start_time, end_time);
      await tx.slot.createMany({ data: slotsData });
      return shift;
    });
  }

  async bulkWeekly(dto: BulkWeeklyShiftDto) {
    const {
      week_start,
      days = [0, 1, 2, 3, 4],
      start_time,
      end_time,
      assignments,
      skip_conflicts = true,
    } = dto;

    if (!this.isMondayDateString(week_start)) {
      throw new BadRequestException({
        message: 'week_start không hợp lệ',
        detail: `week_start (${week_start}) phải là ngày Thứ 2 (Monday) theo giờ Việt Nam.`,
      });
    }

    if (this.timeToMinutes(end_time) <= this.timeToMinutes(start_time)) {
      throw new BadRequestException({
        message: 'Khoảng thời gian không hợp lệ',
        detail: 'end_time phải lớn hơn start_time.',
      });
    }

    const uniqueDays = [...new Set(days)];
    const totalCombinations = assignments.length * uniqueDays.length;
    if (totalCombinations > 500) {
      throw new BadRequestException({
        message: 'Vượt quá giới hạn cho phép',
        detail: `assignments (${assignments.length}) x days (${uniqueDays.length}) = ${totalCombinations} vượt quá giới hạn 500 ca/request.`,
      });
    }

    const created: unknown[] = [];
    const skipped: Array<{ room_id: string; staff_id: string; date: string; reason: string }> = [];
    const errors: Array<{ room_id: string; staff_id: string; date: string; reason: string }> = [];

    for (const dayOffset of uniqueDays) {
      const dateStr = this.addDaysToDateString(week_start, dayOffset);

      for (const assignment of assignments) {
        const { room_id, staff_id } = assignment;

        try {
          const shift = await this.createShiftWithSlots({
            room_id,
            staff_id,
            dateStr,
            start_time,
            end_time,
          });
          created.push(shift);
        } catch (error: unknown) {
          const reason = this.classifyBulkError(error);

          if (skip_conflicts) {
            skipped.push({ room_id, staff_id, date: dateStr, reason });
          } else {
            errors.push({ room_id, staff_id, date: dateStr, reason });
            return {
              code: 207,
              status: 'partial',
              message: `Tạo ca trực theo tuần dừng lại do lỗi (skip_conflicts=false). Đã tạo ${created.length} ca trước khi dừng.`,
              data: { created: created.length, skipped, errors },
            };
          }
        }
      }
    }

    return {
      code: 201,
      status: 'success',
      message: `Đã tạo ${created.length} ca trực theo tuần (${skipped.length} bị bỏ qua).`,
      data: { created: created.length, skipped, errors },
    };
  }

  async bulkImport(dto: BulkImportShiftDto) {
    const { items, skip_conflicts = true } = dto;

    const created: unknown[] = [];
    const skipped: Array<{ room_id: string; staff_id: string; date: string; reason: string }> = [];
    const errors: Array<{ room_id: string; staff_id: string; date: string; reason: string }> = [];

    for (const item of items) {
      const { room_id, staff_id, date, start_time, end_time } = item;

      try {
        const shift = await this.createShiftWithSlots({
          room_id,
          staff_id,
          dateStr: date,
          start_time,
          end_time,
        });
        created.push(shift);
      } catch (error: unknown) {
        const reason = this.classifyBulkError(error);

        if (skip_conflicts) {
          skipped.push({ room_id, staff_id, date, reason });
        } else {
          errors.push({ room_id, staff_id, date, reason });
          return {
            code: 207,
            status: 'partial',
            message: `Import ca trực dừng lại do lỗi (skip_conflicts=false). Đã tạo ${created.length} ca trước khi dừng.`,
            data: { created: created.length, skipped, errors },
          };
        }
      }
    }

    return {
      code: 201,
      status: 'success',
      message: `Đã tạo ${created.length} ca trực từ file import (${skipped.length} bị bỏ qua).`,
      data: { created: created.length, skipped, errors },
    };
  }
}
