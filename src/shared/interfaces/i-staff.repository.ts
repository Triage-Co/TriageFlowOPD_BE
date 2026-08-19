import { ClinicalRoomType, Prisma, Staff } from '@prisma/client';

export interface IStaffRepository {
  create(
    data: Prisma.StaffUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<any>;
  update(
    id: string,
    data: Prisma.StaffUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<any>;
  findAll(
    page?: number,
    limit?: number,
    is_active?: boolean,
    search?: string,
    role?: string,
  ): Promise<any>;
  findById(id: string): Promise<any>;
  findDoctorsBySpecialtyAndDate(
    specialtyId: string,
    startTime?: Date,
    endTime?: Date,
    roomType?: ClinicalRoomType,
  ): Promise<any>;
}
