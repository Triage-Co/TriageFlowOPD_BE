import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateDoctorDto } from './dto/request-doctor.dto';
import { PrismaConfig } from '../../shared/config/prisma.config';

@Injectable()
export class DoctorService {

  constructor(private readonly pismaClient: PrismaConfig) { }

  async create(createDoctorDto: CreateDoctorDto) {
    try {

      const exitedDoctor = await this.pismaClient.doctors.findUnique({
        where: {
          id: createDoctorDto.userId
        }
      })

      if (exitedDoctor) {
        return {
          code: 404,
          message: "Doctor đã tồn tại trong hệ thống",
          status: "error"
        }
      }
      const data = await this.pismaClient.doctors.create({
        data: {
          id: createDoctorDto.userId,
          practiceCertificateNumber: createDoctorDto.practiceCertificateNumber,
          specialtyId: createDoctorDto.specialtyId
        }
      })
      return {
        code: 200,
        message: "Thêm bác sĩ thành công",
        status: "success",
        data: data
      };
    } catch (error) {
      return {
        code: 500,
        message: error,
        status: "error",
      }
    }
  }

  async findAll() {
    try {
      const data = await this.pismaClient.doctors.findMany({
        select: {
          id: true,
          doctor: {
            select: {
              full_name: true,
            }
          },
          specialty: {
            select: {
              id: true,
              name: true
            }
          },
          practiceCertificateNumber: true
        },

      })

      if (!data) {
        throw new BadRequestException("Không có bác sĩ nào trong danh sách")
      }
      return {
        code: 200,
        message: "Lấy danh sách bác sĩ thành công",
        status: "success",
        data: data
      };
    } catch (error) {
      return {
        code: 500,
        message: error instanceof Error ? error.message : "Unknow Error",
        status: "error",
      }
    }
  }

  async findOne(id: string) {
    try {
      const data = await this.pismaClient.doctors.findFirst({
        where: {
          id: id
        },
        select: {
          id: true,
          doctor: {
            select: {
              id: true,
              full_name: true,
              citizen_id: true,
              dob: true,
              email: true,
              gender: true,
            }
          },
          specialty: {
            select: {
              id: true,
              name: true,
            }
          },
          practiceCertificateNumber: true
        }
      })

      if (!data) {
        throw new BadRequestException("Không có bác sĩ nào trong danh sách")
      }
      return {
        code: 200,
        message: "Lấy danh sách bác sĩ theo id sĩ thành công",
        status: "success",
        data: data
      };
    } catch (error) {
      return {
        code: 500,
        message: error instanceof Error ? error.message : "Unknow Error",
        status: "error",
      }
    }
  }

}
