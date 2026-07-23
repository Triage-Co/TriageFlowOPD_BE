import { Injectable, NotFoundException } from '@nestjs/common';

import { Prisma, PrismaClient, RoleTypeEnum } from '@prisma/client';
import { PrismaService } from '../../shared/config/prisma.service';
import { formatInTimeZone, toDate } from 'date-fns-tz';

@Injectable()
export class DoctorService {
  STAFF: PrismaClient['staff'];
  SLOT: PrismaClient['slot'];
  SPECIALTY: PrismaClient['specialty'];
  SHIFT: PrismaClient['shift'];
  STEP: PrismaClient['step'];
  QUEUE: PrismaClient['queue'];
  constructor(private readonly prismaService: PrismaService) {
    this.STAFF = prismaService.staff;
    this.SLOT = prismaService.slot;
    this.SHIFT = prismaService.shift;
    this.SPECIALTY = prismaService.specialty;
    this.STEP = prismaService.step;
    this.QUEUE = prismaService.queue;
  }

  async findAll() {
    try {
      const data = await this.STAFF.findMany({
        include: {
          account: true,
        },
        where: {
          account: {
            role: RoleTypeEnum.DOCTOR,
          },
        },
      });

      if (!data) {
        throw new NotFoundException({
          message: 'Danh sách rỗng',
          detail: 'Không tìm thấy bác sĩ nào trong hệ thống',
        });
      }

      return {
        code: 200,
        message: 'Lấy danh sách bác sĩ thành công',
        status: 'success',
        data: data,
      };
    } catch (error) {
      throw error;
    }
  }

  async findAllWithSpecialCode(specialCode: string, dateTimeStr: string) {
    try {
      const existedSpecialtyCode = await this.SPECIALTY.findFirst({
        where: {
          specialty_code: {
            equals: specialCode,
            mode: 'insensitive',
          },
        },
      });

      if (!existedSpecialtyCode) {
        throw new NotFoundException({
          message: 'Danh sách rỗng',
          detail: `Không tìm thấy chuyên ngành nào với mã ${specialCode} trong hệ thống`,
        });
      }

      let data: Prisma.InputJsonValue;

      if (!dateTimeStr) {
        data = await this.STAFF.findMany({
          include: {
            account: true,
            specialty: true,
            shifts: {
              select: {
                date: true,
                slots: true,
              },
            },
          },
          omit: {
            specialty_id: true,
          },
          where: {
            specialty_id: existedSpecialtyCode.specialty_id,
            account: {
              role: RoleTypeEnum.DOCTOR,
            },
          },
        });
      } else {
        const timeZone = 'Asia/Ho_Chi_Minh';

        const targetDate = new Date(dateTimeStr);
        const dateString = formatInTimeZone(targetDate, timeZone, 'yyyy-MM-dd');

        const start = toDate(`${dateString}T00:00:00`, { timeZone });
        const end = toDate(`${dateString}T23:59:59.999`, { timeZone });

        data = await this.STAFF.findMany({
          include: {
            account: true,
            specialty: true,
            shifts: {
              where: {
                date: {
                  gte: start,
                  lte: end,
                },
              },
              select: {
                date: true,
                slots: true,
              },
            },
          },
          where: {
            specialty_id: existedSpecialtyCode.specialty_id,
            account: {
              role: RoleTypeEnum.DOCTOR,
            },
            shifts: {
              some: {
                date: {
                  gte: start,
                  lte: end,
                },
              },
            },
          },
        });
      }

      if (data.length <= 0) {
        throw new NotFoundException({
          message: 'Danh sách rỗng',
          detail: `Không tìm thấy bác sĩ nào với chuyên ngành ${existedSpecialtyCode.specialty_name} có ca trực ${
            dateTimeStr ? 'trong ngày ' + dateTimeStr : ''
          } trong hệ thống`,
        });
      }
      return {
        code: 200,
        message: `Lấy danh sách bác sĩ thành công`,
        status: 'success',
        data: data,
      };
    } catch (error) {
      throw error;
    }
  }

  async findAllWithSpecialCodeWithSlotAndDate(
    specialCode: string,
    dateTimeStr: string,
  ) {
    try {
      const timeZone = 'Asia/Ho_Chi_Minh';
      const targetDate = new Date(dateTimeStr);
      const dateString = formatInTimeZone(targetDate, timeZone, 'yyyy-MM-dd');

      const start = toDate(`${dateString}T00:00:00`, { timeZone });
      const end = toDate(`${dateString}T23:59:59.999`, { timeZone });

      const existedSpecialtyCode = await this.SPECIALTY.findFirst({
        where: {
          specialty_code: {
            equals: specialCode,
            mode: 'insensitive',
          },
        },
      });
      if (!existedSpecialtyCode) {
        throw new NotFoundException({
          message: 'Danh sách rỗng',
          detail: `Không tìm thấy chuyên ngành nào với mã ${specialCode} trong hệ thống`,
        });
      }

      const data = await this.STAFF.findMany({
        include: {
          account: true,
          specialty: true,
          shifts: {
            where: {
              date: {
                gte: start,
                lte: end,
              },
            },
            select: {
              slots: true,
            },
          },
        },
        where: {
          specialty_id: existedSpecialtyCode.specialty_id,
          account: {
            role: RoleTypeEnum.DOCTOR,
          },
        },
      });

      if (!data) {
        throw new NotFoundException({
          message: 'Danh sách rỗng',
          detail: `Không tìm thấy bác sĩ nào với chuyên ngành với chuyên ngành ${existedSpecialtyCode.specialty_name} trong hệ thống`,
        });
      }

      return {
        code: 200,
        message: `Lấy danh sách bác sĩ thành công`,
        status: 'success',
        data: data,
      };
    } catch (error) {
      throw error;
    }
  }

  async findOne(id: string) {
    try {
      const data = await this.STAFF.findFirst({
        include: {
          account: true,
        },
        where: {
          staff_id: id,
          account: {
            role: RoleTypeEnum.DOCTOR,
          },
        },
      });

      if (!data) {
        throw new NotFoundException({
          message: 'Danh sách rỗng',
          detail: `Không tìm thấy bác sĩ với id ${id}`,
        });
      }

      return {
        code: 200,
        message: `Lấy bác sĩ với id ${id} thành công`,
        status: 'success',
        data: data,
      };
    } catch (error) {
      throw error;
    }
  }
  async findOneWithSlotAndDate(id: string, dateTimeStr: string) {
    try {
      const timeZone = 'Asia/Ho_Chi_Minh';

      const targetDate = new Date(dateTimeStr);
      const dateString = formatInTimeZone(targetDate, timeZone, 'yyyy-MM-dd');

      const start = toDate(`${dateString}T00:00:00`, { timeZone });
      const end = toDate(`${dateString}T23:59:59.999`, { timeZone });
      const existedShift = await this.SHIFT.findFirst({
        where: {
          date: {
            gte: start,
            lte: end,
          },
          staff: {
            staff_id: id,
            account: {
              role: RoleTypeEnum.DOCTOR,
            },
          },
        },
        select: {
          shift_id: true,
        },
      });

      if (!existedShift) {
        throw new NotFoundException({
          message: 'Bác sĩ không có lịch làm  việc',
          detail: `Bác sĩ không có có lịch làm việc trong ngày ${dateTimeStr}`,
        });
      }

      const existedSlot = await this.SLOT.findMany({
        where: {
          shift_id: existedShift.shift_id,
        },
      });

      if (!existedSlot) {
        throw new NotFoundException({
          message: 'Không tìm thấy ca trực',
          detail: `Bác sĩ không có có ca trực trong ngày ${dateTimeStr}`,
        });
      }
      const data = await this.STAFF.findFirst({
        include: {
          account: true,
          specialty: true,
        },
        where: {
          staff_id: id,
          account: {
            role: RoleTypeEnum.DOCTOR,
          },
        },
      });

      if (!data) {
        throw new NotFoundException({
          message: 'Danh sách rỗng',
          detail: `Không tìm thấy bác sĩ với id ${id}`,
        });
      }

      return {
        code: 200,
        message: `Lấy bác sĩ với id ${id} thành công`,
        status: 'success',
        data: {
          ...data,
          existedSlot,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async getPatients(staff_id: string, dateStr?: string) {
    try {
      const whereCondition: any = {
        step: {
          staff_id: staff_id,
        },
      };

      if (dateStr) {
        const timeZone = 'Asia/Ho_Chi_Minh';

        const targetDate = new Date(dateStr);
        const dateString = formatInTimeZone(targetDate, timeZone, 'yyyy-MM-dd');

        const start = toDate(`${dateString}T00:00:00`, { timeZone });
        const end = toDate(`${dateString}T23:59:59.999`, { timeZone });
        whereCondition.step.flow = {
          booking: {
            slot: {
              shift: {
                date: {
                  gte: start,
                  lte: end,
                },
              },
            },
          },
        };
      }

      const existedQueue = await this.QUEUE.findMany({
        where: whereCondition,
        omit: {
          step_id: true,
        },
        include: {
          step: {
            include: {
              flow: {
                omit: {
                  booking_id: true,
                },
                include: {
                  steps: {
                    select: {
                      queues: {
                        select: {
                          queue_number: true,
                        },
                      },
                    },
                  },
                  booking: {
                    omit: {
                      patient_id: true,
                      slot_id: true,
                    },
                    include: {
                      slot: {
                        select: {
                          slot_id: true,
                          start_time: true,
                          end_time: true,
                          shift: {
                            select: {
                              date: true,
                            },
                          },
                        },
                      },
                      patient: {
                        omit: {
                          updatedAt: true,
                          createdAt: true,
                        },
                        include: {
                          account: {
                            omit: {
                              createdAt: true,
                              updatedAt: true,
                              account_id: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (existedQueue.length === 0) {
        throw new NotFoundException({
          detail: dateStr
            ? `Không tìm thấy bệnh nhân nào trong danh sách ngày ${dateStr}`
            : 'Không tìm thấy bệnh nhân nào trong danh sách',
          message: 'Danh sách rỗng',
        });
      }

      return {
        code: 200,
        status: 'success',
        message: 'Lấy danh sách bệnh nhân thành công',
        data: existedQueue,
      };
    } catch (error) {
      throw error;
    }
  }

  async getPatientByQueueId(queue_id: string, staff_id: string) {
    try {
      const existedQueue = await this.QUEUE.findFirst({
        where: {
          queue_id: queue_id,
          step: {
            staff_id: staff_id,
          },
        },
        include: {
          step: {
            omit: {
              flow_id: true,
              room_id: true,
              staff_id: true,
            },
            include: {
              flow: {
                omit: {
                  booking_id: true,
                },
                include: {
                  steps: {
                    include: {
                      queues: {
                        select: {
                          queue_number: true,
                        },
                      },
                    },
                  },
                  booking: {
                    omit: {
                      patient_id: true,
                      slot_id: true,
                    },
                    include: {
                      slot: {
                        select: {
                          slot_id: true,
                          start_time: true,
                          end_time: true,
                          shift: {
                            select: {
                              date: true,
                            },
                          },
                        },
                      },
                      patient: {
                        omit: {
                          updatedAt: true,
                          createdAt: true,
                        },
                        include: {
                          account: {
                            omit: {
                              createdAt: true,
                              updatedAt: true,
                              account_id: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!existedQueue) {
        throw new NotFoundException({
          detail: `Không tìm thấy bệnh nhân nào với mã hàng đợi ${queue_id}`,
          message: 'Dữ liệu rỗng',
        });
      }

      return {
        code: 200,
        status: 'success',
        message: 'Lấy thông tin bệnh nhân thành công',
        data: existedQueue,
      };
    } catch (error) {
      throw error;
    }
  }
}
