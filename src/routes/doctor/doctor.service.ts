import { Injectable } from '@nestjs/common';
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
      const data = await this.pismaClient.doctors.findMany()
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

}
