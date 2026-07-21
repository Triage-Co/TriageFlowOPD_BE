import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateVisitSessionReqDto, UpdateVisitSessionReqDto } from './dto/request-visit-session.dto';
import type { IVisitSessionRepository } from '../../shared/interfaces/i-visit-session.repository';
import type { IPatientRepository } from '../../shared/interfaces/i-patient.repository';
import type { IAccountRepository } from '../../shared/interfaces/i-account.repository';

@Injectable()
export class VisitSessionService {
  constructor(
    @Inject('IVisitSessionRepository')
    private readonly visitSessionRepository: IVisitSessionRepository,
    @Inject('IPatientRepository')
    private readonly patientRepository: IPatientRepository,
    @Inject('IAccountRepository')
    private readonly accountRepository: IAccountRepository,
  ) {}

  async create(createDto: CreateVisitSessionReqDto) {
    const patient = await this.patientRepository.findOneWithPatientId(createDto.patient_id);
    if (!patient) {
      throw new NotFoundException(`Patient with ID ${createDto.patient_id} not found`);
    }
    return this.visitSessionRepository.create(createDto);
  }

  async findAll(patient_id?: string) {
    return this.visitSessionRepository.findAll(patient_id);
  }

  async findByPatient(patientId: string, reqUser: any) {
    const account = await this.accountRepository.findById(reqUser.id);
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    if (account.role === 'USER') {
      const patient = await this.patientRepository.findOne(patientId, reqUser.id);
      if (!patient) {
        throw new ForbiddenException("You do not have permission to access this patient's records");
      }
    }

    return this.visitSessionRepository.findAll(patientId);
  }

  async getMySessions(accountId: string) {
    const patients = await this.patientRepository.findAll(accountId);
    if (!patients || patients.length === 0) {
      return [];
    }
    const sessions: any[] = [];
    for (const patient of patients) {
      const patientSessions = await this.visitSessionRepository.findAll(patient.patient_id);
      sessions.push(...patientSessions);
    }
    return sessions;
  }

  async findOne(id: string, reqUser: any) {
    const session = await this.visitSessionRepository.findById(id);
    if (!session) {
      throw new NotFoundException(`Visit session with ID ${id} not found`);
    }

    const account = await this.accountRepository.findById(reqUser.id);
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    if (account.role === 'USER') {
      if (session.patient.account_id !== reqUser.id) {
        throw new ForbiddenException('You do not have permission to view this visit session');
      }
    }

    return session;
  }

  async update(id: string, updateDto: UpdateVisitSessionReqDto) {
    const session = await this.visitSessionRepository.findById(id);
    if (!session) {
      throw new NotFoundException(`Visit session with ID ${id} not found`);
    }
    return this.visitSessionRepository.update(id, updateDto);
  }

  async findLatestByPatient(patientId: string, reqUser: any) {
    const account = await this.accountRepository.findById(reqUser.id);
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    if (account.role === 'USER') {
      const patient = await this.patientRepository.findOne(patientId, reqUser.id);
      if (!patient) {
        throw new ForbiddenException("You do not have permission to access this patient's records");
      }
    }

    const session = await this.visitSessionRepository.findLatestByPatient(patientId);
    if (!session) {
      throw new NotFoundException(`No visit session found for patient ID ${patientId}`);
    }
    return session;
  }

  async updateLatestByPatient(patientId: string, updateDto: UpdateVisitSessionReqDto) {
    const session = await this.visitSessionRepository.findLatestByPatient(patientId);
    if (!session) {
      throw new NotFoundException(`No visit session found for patient ID ${patientId}`);
    }
    return this.visitSessionRepository.update(session.visit_session_id, updateDto);
  }

  async remove(id: string) {
    const session = await this.visitSessionRepository.findById(id);
    if (!session) {
      throw new NotFoundException(`Visit session with ID ${id} not found`);
    }
    await this.visitSessionRepository.delete(id);
    return {
      message: `Visit session with ID ${id} deleted successfully`,
    };
  }
}
