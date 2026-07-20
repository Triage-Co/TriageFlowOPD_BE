import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateClinicalDocumentReqDto, UpdateClinicalDocumentReqDto } from './dto/request-clinical-document.dto';
import type { IClinicalDocumentRepository } from '../../shared/interfaces/i-clinical-document.repository';
import type { IVisitSessionRepository } from '../../shared/interfaces/i-visit-session.repository';
import type { IPatientRepository } from '../../shared/interfaces/i-patient.repository';
import type { IAccountRepository } from '../../shared/interfaces/i-account.repository';

@Injectable()
export class ClinicalDocumentService {
  constructor(
    @Inject('IClinicalDocumentRepository')
    private readonly clinicalDocumentRepository: IClinicalDocumentRepository,
    @Inject('IVisitSessionRepository')
    private readonly visitSessionRepository: IVisitSessionRepository,
    @Inject('IPatientRepository')
    private readonly patientRepository: IPatientRepository,
    @Inject('IAccountRepository')
    private readonly accountRepository: IAccountRepository,
  ) {}

  async create(createDto: CreateClinicalDocumentReqDto) {
    const session = await this.visitSessionRepository.findById(createDto.visit_session_id);
    if (!session) {
      throw new NotFoundException(`Visit session with ID ${createDto.visit_session_id} not found`);
    }
    return this.clinicalDocumentRepository.create(createDto);
  }

  async findAll(visit_session_id?: string) {
    return this.clinicalDocumentRepository.findAll(visit_session_id);
  }

  async findByVisitSession(visitSessionId: string, reqUser: any) {
    const session = await this.visitSessionRepository.findById(visitSessionId);
    if (!session) {
      throw new NotFoundException(`Visit session with ID ${visitSessionId} not found`);
    }

    const account = await this.accountRepository.findById(reqUser.id);
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    if (account.role === 'USER') {
      if (session.patient.account_id !== reqUser.id) {
        throw new ForbiddenException("You do not have permission to view this visit session's clinical documents");
      }
    }

    return this.clinicalDocumentRepository.findAll(visitSessionId);
  }

  async getMyDocuments(accountId: string) {
    const patients = await this.patientRepository.findAll(accountId);
    if (!patients || patients.length === 0) {
      return [];
    }

    const documents: any[] = [];
    for (const patient of patients) {
      const sessions = await this.visitSessionRepository.findAll(patient.patient_id);
      for (const session of sessions) {
        const sessionDocs = await this.clinicalDocumentRepository.findAll(session.visit_session_id);
        documents.push(...sessionDocs);
      }
    }
    return documents;
  }

  async findOne(id: string, reqUser: any) {
    const doc = await this.clinicalDocumentRepository.findById(id);
    if (!doc) {
      throw new NotFoundException(`Clinical document with ID ${id} not found`);
    }

    const account = await this.accountRepository.findById(reqUser.id);
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    if (account.role === 'USER') {
      if (doc.visitSession?.patient?.account_id !== reqUser.id) {
        throw new ForbiddenException('You do not have permission to view this clinical document');
      }
    }

    return doc;
  }

  async update(id: string, updateDto: UpdateClinicalDocumentReqDto) {
    const doc = await this.clinicalDocumentRepository.findById(id);
    if (!doc) {
      throw new NotFoundException(`Clinical document with ID ${id} not found`);
    }

    if (updateDto.visit_session_id) {
      const session = await this.visitSessionRepository.findById(updateDto.visit_session_id);
      if (!session) {
        throw new NotFoundException(`Visit session with ID ${updateDto.visit_session_id} not found`);
      }
    }

    return this.clinicalDocumentRepository.update(id, updateDto);
  }

  async remove(id: string) {
    const doc = await this.clinicalDocumentRepository.findById(id);
    if (!doc) {
      throw new NotFoundException(`Clinical document with ID ${id} not found`);
    }
    await this.clinicalDocumentRepository.delete(id);
    return {
      message: `Clinical document with ID ${id} deleted successfully`,
    };
  }
}
