import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreatePatientReqDto, UpdatePatientReqDto } from './dto/request-patient.dto';
import type { IPatientRepository } from '../../shared/interfaces/i-patient.repository';

@Injectable()
export class PatientService {
  constructor(
    @Inject('IPatientRepository')
    private readonly patientRepository: IPatientRepository,
  ) {}
  async create(account_id: string, createPatientReqDto: CreatePatientReqDto) {
    const createPatientData = await this.patientRepository.create(
      account_id,
      createPatientReqDto,
    );

    return {
      code: 200,
      status: 'success',
      message: 'Tạo bệnh nhân thành công',
      data: createPatientData,
    };
  }

  async findAll(account_id: string) {
    const getPatientData = await this.patientRepository.findAll(account_id);

    if (!getPatientData) {
      throw new NotFoundException({
        message: 'Danh sách rỗng',
        detail: 'Không có bệnh nhân nào trong danh sách',
      });
    }

    return {
      code: 200,
      status: 'success',
      message: 'Lấy danh sách bệnh nhân thành công',
      data: getPatientData,
    };
  }

  async findOne(account_id: string, patient_id: string) {
    const getPatientData = await this.patientRepository.findOne(
      account_id,
      patient_id,
    );

    if (!getPatientData) {
      throw new NotFoundException({
        message: 'Danh sách rỗng',
        detail: `Không có bệnh nhân với id ${patient_id} trong hệ thống`,
      });
    }

    return {
      code: 200,
      status: 'success',
      message: 'Lấy danh sách bệnh nhân thành công',
      data: getPatientData,
    };
  }

  async update(account_id: string, patient_id: string, updatePatientReqDto: UpdatePatientReqDto) {
    const updatePatientData = await this.patientRepository.update(
      account_id,
      patient_id,
      updatePatientReqDto,
    );

    return {
      code: 200,
      status: 'success',
      message: 'Cập nhật bệnh nhân thành công',
      data: updatePatientData,
    };
  }

  async remove(account_id: string, patient_id: string) {
    await this.patientRepository.delete(account_id, patient_id);

    return {
      code: 200,
      status: 'success',
      message: `xóa bệnh nhân với id ${patient_id} thành công`,
    };
  }
}
