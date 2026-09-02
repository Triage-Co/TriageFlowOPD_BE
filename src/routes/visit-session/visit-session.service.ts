import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  forwardRef,
} from '@nestjs/common';
import {
  CreateVisitSessionReqDto,
  UpdateVisitSessionReqDto,
} from './dto/request-visit-session.dto';
import type { IVisitSessionRepository } from '../../shared/interfaces/i-visit-session.repository';
import type { IPatientRepository } from '../../shared/interfaces/i-patient.repository';
import type { IAccountRepository } from '../../shared/interfaces/i-account.repository';
import { PrismaService } from '../../shared/config/prisma.service';
import { HisService } from '../his/his.service';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class VisitSessionService {
  private readonly logger = new Logger(VisitSessionService.name);

  constructor(
    @Inject('IVisitSessionRepository')
    private readonly visitSessionRepository: IVisitSessionRepository,
    @Inject('IPatientRepository')
    private readonly patientRepository: IPatientRepository,
    @Inject('IAccountRepository')
    private readonly accountRepository: IAccountRepository,
    private readonly prismaService: PrismaService,
    private readonly hisService: HisService,
    @Inject(forwardRef(() => QueueService))
    private readonly queueService: QueueService,
  ) {}

  async create(createDto: CreateVisitSessionReqDto) {
    const patient = await this.patientRepository.findOneWithPatientId(
      createDto.patient_id,
    );
    if (!patient) {
      throw new NotFoundException(
        `Patient with ID ${createDto.patient_id} not found`,
      );
    }
    if (createDto.manual_rule_codes !== undefined) {
      createDto.manual_rule_codes =
        await this.queueService.assertValidManualRuleCodes(
          createDto.manual_rule_codes,
        );
    }
    return this.visitSessionRepository.create(createDto);
  }

  async findAll(patient_id?: string) {
    if (patient_id) {
      try {
        await this.hisService.syncPatientExamFromHis(patient_id);
      } catch (err: any) {
        this.logger.debug(
          `Auto-sync từ HIS cho patient_id ${patient_id} bỏ qua: ${err.message}`,
        );
      }
    }
    const sessions = await this.visitSessionRepository.findAll(patient_id);
    if (sessions && sessions.length > 0 && (!sessions[0].pmh || !sessions[0].pmh.trim())) {
      const prevWithPmh = sessions.find((s: any) => s.pmh && s.pmh.trim());
      if (prevWithPmh) {
        sessions[0].pmh = prevWithPmh.pmh.trim();
        this.visitSessionRepository.update(sessions[0].visit_session_id, {
          pmh: prevWithPmh.pmh.trim(),
        }).catch(() => {});
      }
    }
    return sessions;
  }

  async findByPatient(patientId: string, reqUser: any) {
    const id = reqUser.sub || reqUser.id;
    const account = await this.accountRepository.findById(id);
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    if (account.role === 'USER') {
      const patient = await this.patientRepository.findOne(patientId, id);
      if (!patient) {
        throw new ForbiddenException(
          "You do not have permission to access this patient's records",
        );
      }
    }

    try {
      await this.hisService.syncPatientExamFromHis(patientId);
    } catch (err: any) {
      this.logger.debug(
        `Auto-sync từ HIS cho patientId ${patientId} bỏ qua: ${err.message}`,
      );
    }

    const sessions = await this.visitSessionRepository.findAll(patientId);
    if (sessions && sessions.length > 0 && (!sessions[0].pmh || !sessions[0].pmh.trim())) {
      const prevWithPmh = sessions.find((s: any) => s.pmh && s.pmh.trim());
      if (prevWithPmh) {
        sessions[0].pmh = prevWithPmh.pmh.trim();
        this.visitSessionRepository.update(sessions[0].visit_session_id, {
          pmh: prevWithPmh.pmh.trim(),
        }).catch(() => {});
      }
    }
    return sessions;
  }

  async getMySessions(accountId: string) {
    const patients = await this.patientRepository.findAll(accountId);
    if (!patients || patients.length === 0) {
      return [];
    }
    const sessions: any[] = [];
    for (const patient of patients) {
      const patientSessions = await this.visitSessionRepository.findAll(
        patient.patient_id,
      );
      sessions.push(...patientSessions);
    }
    return sessions;
  }

  async findOne(id: string, reqUser: any) {
    const userId = reqUser.sub || reqUser.id;
    const session = await this.visitSessionRepository.findById(id);
    if (!session) {
      throw new NotFoundException(`Visit session with ID ${id} not found`);
    }

    const account = await this.accountRepository.findById(userId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    if (account.role === 'USER') {
      if (session.patient.account_id !== userId) {
        throw new ForbiddenException(
          'You do not have permission to view this visit session',
        );
      }
    }

    return session;
  }

  async update(id: string, updateDto: UpdateVisitSessionReqDto) {
    const session = await this.visitSessionRepository.findById(id);
    if (!session) {
      throw new NotFoundException(`Visit session with ID ${id} not found`);
    }
    if (updateDto.manual_rule_codes !== undefined) {
      updateDto.manual_rule_codes =
        await this.queueService.assertValidManualRuleCodes(
          updateDto.manual_rule_codes,
        );
    }
    const updated = await this.visitSessionRepository.update(id, updateDto);

    if (updateDto.manual_rule_codes !== undefined) {
      await this.queueService.applyManualRuleCodesForVisit(
        id,
        updateDto.manual_rule_codes,
      );
    }

    // Tự động đồng bộ các cập nhật sang hệ thống HIS
    try {
      await this.hisService.pushVisitSessionToHis(id);
    } catch (err: any) {
      this.logger.warn(
        `Đồng bộ sang HIS cho visit session ${id} gặp lỗi: ${err.message}`,
      );
    }

    return updated;
  }

  async findLatestByPatient(patientId: string, reqUser: any) {
    const id = reqUser.sub || reqUser.id;
    const account = await this.accountRepository.findById(id);
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    if (account.role === 'USER') {
      const patient = await this.patientRepository.findOne(patientId, id);
      if (!patient) {
        throw new ForbiddenException(
          "You do not have permission to access this patient's records",
        );
      }
    }

    try {
      await this.hisService.syncPatientExamFromHis(patientId);
    } catch (err: any) {
      this.logger.debug(
        `Auto-sync từ HIS cho patientId ${patientId} bỏ qua: ${err.message}`,
      );
    }

    const session =
      await this.visitSessionRepository.findLatestByPatient(patientId);
    if (!session) {
      throw new NotFoundException(
        `No visit session found for patient ID ${patientId}`,
      );
    }
    if (!session.pmh || !session.pmh.trim()) {
      const prevWithPmh = await this.prismaService.visit_Session.findFirst({
        where: {
          patient_id: patientId,
          pmh: { not: null },
        },
        orderBy: { visit_date: 'desc' },
      });
      if (prevWithPmh && prevWithPmh.pmh) {
        session.pmh = prevWithPmh.pmh.trim();
        this.visitSessionRepository.update(session.visit_session_id, {
          pmh: prevWithPmh.pmh.trim(),
        }).catch(() => {});
      }
    }
    return session;
  }

  async updateLatestByPatient(
    patientId: string,
    updateDto: UpdateVisitSessionReqDto,
  ) {
    const session =
      await this.visitSessionRepository.findLatestByPatient(patientId);
    if (!session) {
      throw new NotFoundException(
        `No visit session found for patient ID ${patientId}`,
      );
    }
    if (updateDto.manual_rule_codes !== undefined) {
      updateDto.manual_rule_codes =
        await this.queueService.assertValidManualRuleCodes(
          updateDto.manual_rule_codes,
        );
    }
    const updated = await this.visitSessionRepository.update(
      session.visit_session_id,
      updateDto,
    );

    if (updateDto.manual_rule_codes !== undefined) {
      await this.queueService.applyManualRuleCodesForVisit(
        session.visit_session_id,
        updateDto.manual_rule_codes,
      );
    }

    // Tự động đồng bộ các cập nhật sang hệ thống HIS
    try {
      await this.hisService.pushVisitSessionToHis(session.visit_session_id);
    } catch (err: any) {
      this.logger.warn(
        `Đồng bộ sang HIS cho visit session ${session.visit_session_id} gặp lỗi: ${err.message}`,
      );
    }

    return updated;
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

  async getLatestPatientAnswer(patientId: string, reqUser: any) {
    const answer = await this.prismaService.patient_Answer.findFirst({
      where: {
        patient_id: patientId,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    if (!answer) {
      throw new NotFoundException(
        `Không tìm thấy câu trả lời Triage nào cho patient_id ${patientId}`,
      );
    }

    return {
      code: 200,
      message: 'Thành công',
      status: 'success',
      data: answer,
    };
  }
}
