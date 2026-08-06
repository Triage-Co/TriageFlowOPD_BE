import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { IStaffRepository } from '../interfaces/i-staff.repository';
import { Prisma, RoleTypeEnum } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';

@Injectable()
export class PrismaStaffRepository implements IStaffRepository {
  constructor(private readonly prismaService: PrismaService) { }
  async findDoctorsBySpecialtyAndDate(specialtyId: string, startTime?: Date, endTime?: Date): Promise<any> {
    const whereCondition: Prisma.StaffWhereInput = {
      specialty_id: specialtyId,
      account: {
        role: RoleTypeEnum.DOCTOR,
      },
    };

    const includeOption: Prisma.StaffInclude = {
      account: {
        omit: {
          createdAt: true,
          updatedAt: true,
          is_banned: true
        }
      },
      specialty: {
        omit: {
          description: true,
          createdAt: true,
          updatedAt: true
        }
      },
      shifts: {
        select: {
          date: true,
          slots: {
            omit: {
              createdAt: true,
              updatedAt: true,
              slot_index: true
            }
          }
        }
      }
    };

    if (startTime && endTime) {
      whereCondition.shifts = {
        some: {
          date: {
            gte: startTime,
            lte: endTime,
          },
        },
      };
      includeOption.shifts = {
        where: {
          date: {
            gte: startTime,
            lte: endTime,
          },
        },
        select: {
          date: true,
          slots: {
            omit: {
              createdAt: true,
              updatedAt: true,
              slot_index: true
            }
          }
        }
      };
    }

    const rawData = await this.prismaService.staff.findMany({
      where: whereCondition,
      include: includeOption,
      omit: {
        createdAt: true,
        updatedAt: true
      }
    })

    const formatedData = rawData.map(staff => {
      return {
        ...staff,
        shifts: staff.shifts.map(shift => {
          return {
            ...shift,
            date: formatInTimeZone(shift.date, "Asia/Ho_Chi_Minh", "yyyy-MM-dd")
          }
        })
      }
    })

    return formatedData
  }

  create(
    data: Prisma.StaffUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<any> {
    const db = tx || this.prismaService;

    return db.staff.create({
      data,
    });
  }

  update(
    id: string,
    data: Prisma.StaffUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<any> {
    const db = tx || this.prismaService;

    return db.staff.update({
      where: {
        staff_id: id,
      },
      data: {
        ...data,
      },
    });
  }

  findAll(): Promise<any> {
    return this.prismaService.staff.findMany({
      include: {
        account: {
          omit: {
            createdAt: true,
            updatedAt: true,
            account_id: true
          }
        },
      },
      omit: {
        createdAt: true,
        updatedAt: true
      }
    });
  }

  findById(id: string): Promise<any> {
    return this.prismaService.staff.findFirst({
      where: {
        staff_id: id,
      },
      include: {
        account: {
          omit: {
            createdAt: true,
            updatedAt: true,
            account_id: true
          }
        },
      },
      omit: {
        createdAt: true,
        updatedAt: true
      }
    });
  }

}
