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

  async findAll(
    page?: number,
    limit?: number,
    is_active?: boolean,
    search?: string,
    role?: string,
  ): Promise<any> {
    const skip =
      page && limit && page > 0 && limit > 0
        ? (Number(page) - 1) * Number(limit)
        : undefined;

    const take = limit && limit > 0 ? Number(limit) : undefined;

    const whereCondition: Prisma.StaffWhereInput = {};
    const accountWhere: Prisma.AccountWhereInput = {};
    let hasAccountWhere = false;

    if (search) {
      whereCondition.OR = [
        { full_name: { contains: search, mode: 'insensitive' } },
        { account: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (is_active !== undefined) {
      accountWhere.is_banned = !is_active;
      hasAccountWhere = true;
    }

    if (role) {
      accountWhere.role = role as RoleTypeEnum;
      hasAccountWhere = true;
    }

    if (hasAccountWhere) {
      whereCondition.account = accountWhere;
    }

    const [dataStaff, total] = await Promise.all([
      this.prismaService.staff.findMany({
        skip,
        take,
        where: whereCondition,
        include: {
          account: {
            omit: {
              createdAt: true,
              updatedAt: true,
              account_id: true,
            },
          },
          specialty: {
            select: {
              specialty_name: true,
            }
          }
        },
        omit: {
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prismaService.staff.count({
        where: whereCondition,
      }),
    ]);

    return {
      data: dataStaff,
      meta: {
        total,
        page: Number(page) || 1,
        limit: take ?? total,
        totalPages: take ? Math.ceil(total / take) : 1,
      },
    };
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
