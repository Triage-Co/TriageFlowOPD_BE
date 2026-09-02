import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../shared/config/prisma.service';
import envInstance from '../../shared/config/env.config';

export interface ExamHisData {
  id: string;
  citizen_id: string;
  visit_date?: string | Date;
  chief_complaint?: string;
  heart_rate?: number;
  blood_pressure_sys?: number;
  blood_pressure_dia?: number;
  temperature?: number;
  spo2?: number;
  diagnosis?: string;
  final_diagnosis?: string;
  hpi?: string;
  pmh?: string;
  pe?: Record<string, any>;
  allergy_notes?: string;
  blood_type?: string;
}

@Injectable()
export class HisService {
  private readonly logger = new Logger(HisService.name);
  private readonly hisBaseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly prismaService: PrismaService,
  ) {
    this.hisBaseUrl =
      process.env.HIS_BASE_URL ||
      envInstance.HIS_BASE_URL ||
      'http://localhost:3002';
  }

  /**
   * Gọi HIS API để lấy thông tin bệnh án mới nhất theo số CCCD (citizen_id)
   */
  async fetchLatestExamFromHisByCitizenId(
    citizenId: string,
  ): Promise<ExamHisData | null> {
    try {
      const url = `${this.hisBaseUrl}/api/exam-his/citizen/${encodeURIComponent(citizenId)}/latest`;
      const response = await firstValueFrom(
        this.httpService.get(url, {
          timeout: 5000,
        }),
      );

      if (response?.data?.data) {
        return response.data.data as ExamHisData;
      }
      return null;
    } catch (error: any) {
      if (error?.response?.status === 404) {
        this.logger.debug(
          `HIS không có hồ sơ bệnh án nào cho CCCD: ${citizenId}`,
        );
        return null;
      }
      this.logger.warn(
        `Không thể kết nối đến hệ thống HIS tại ${this.hisBaseUrl}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Gọi HIS API để lấy danh sách tất cả các lần khám theo số CCCD (citizen_id)
   */
  async fetchAllExamsFromHisByCitizenId(
    citizenId: string,
  ): Promise<ExamHisData[]> {
    try {
      const url = `${this.hisBaseUrl}/api/exam-his/citizen/${encodeURIComponent(citizenId)}`;
      const response = await firstValueFrom(
        this.httpService.get(url, {
          timeout: 5000,
        }),
      );

      if (response?.data?.data && Array.isArray(response.data.data)) {
        return response.data.data as ExamHisData[];
      }
      return [];
    } catch (error: any) {
      this.logger.warn(
        `Lỗi khi lấy danh sách bệnh án từ HIS cho CCCD ${citizenId}: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Tự động hoặc chủ động import thông tin bệnh án từ HIS vào Patient và Visit_Session theo patient_id
   */
  async syncPatientExamFromHis(
    patientId: string,
    targetVisitSessionId?: string,
    examDataOverride?: ExamHisData,
  ) {
    const patient = await this.prismaService.patient.findUnique({
      where: { patient_id: patientId },
    });

    if (!patient) {
      throw new NotFoundException(
        `Không tìm thấy bệnh nhân với ID: ${patientId}`,
      );
    }

    if (!patient.citizen_id) {
      this.logger.warn(
        `Bệnh nhân ${patientId} (${patient.full_name}) chưa có số CCCD (citizen_id) để tra cứu trên HIS`,
      );
      return null;
    }

    const hisExam =
      examDataOverride ||
      (await this.fetchLatestExamFromHisByCitizenId(patient.citizen_id));

    if (!hisExam) {
      return null;
    }

    // 1. Cập nhật allergy_notes và blood_type vào bảng Patient nếu HIS có thông tin
    const patientUpdateData: { allergy_notes?: string; blood_type?: string } =
      {};
    if (hisExam.allergy_notes !== undefined && hisExam.allergy_notes !== null) {
      patientUpdateData.allergy_notes = hisExam.allergy_notes;
    }
    if (hisExam.blood_type !== undefined && hisExam.blood_type !== null) {
      patientUpdateData.blood_type = hisExam.blood_type;
    }
    if (Object.keys(patientUpdateData).length > 0) {
      await this.prismaService.patient.update({
        where: { patient_id: patientId },
        data: patientUpdateData,
      });
      this.logger.log(
        `Đã đồng bộ thông tin y tế (dị ứng: "${hisExam.allergy_notes || 'N/A'}", nhóm máu: "${hisExam.blood_type || 'N/A'}") vào hồ sơ bệnh nhân ${patient.full_name} (${patient.citizen_id})`,
      );
    }

    // 2. Cập nhật hồ sơ khám vào Visit_Session
    let visitSession: any = null;

    if (targetVisitSessionId) {
      visitSession = await this.prismaService.visit_Session.findUnique({
        where: { visit_session_id: targetVisitSessionId },
      });
    }

    if (!visitSession) {
      visitSession = await this.prismaService.visit_Session.findFirst({
        where: { patient_id: patientId },
        orderBy: { visit_date: 'desc' },
      });
    }

    const updatePayload: any = {};
    if (
      hisExam.chief_complaint !== undefined &&
      hisExam.chief_complaint !== null
    )
      updatePayload.chief_complaint = hisExam.chief_complaint.trim();
    if (hisExam.heart_rate !== undefined && hisExam.heart_rate !== null)
      updatePayload.heart_rate = Number(hisExam.heart_rate);
    if (
      hisExam.blood_pressure_sys !== undefined &&
      hisExam.blood_pressure_sys !== null
    )
      updatePayload.blood_pressure_sys = Number(hisExam.blood_pressure_sys);
    if (
      hisExam.blood_pressure_dia !== undefined &&
      hisExam.blood_pressure_dia !== null
    )
      updatePayload.blood_pressure_dia = Number(hisExam.blood_pressure_dia);
    if (hisExam.temperature !== undefined && hisExam.temperature !== null)
      updatePayload.temperature = Number(hisExam.temperature);
    if (hisExam.spo2 !== undefined && hisExam.spo2 !== null)
      updatePayload.spo2 = Number(hisExam.spo2);
    if (hisExam.diagnosis !== undefined && hisExam.diagnosis !== null)
      updatePayload.diagnosis = hisExam.diagnosis.trim();
    if (
      hisExam.final_diagnosis !== undefined &&
      hisExam.final_diagnosis !== null
    )
      updatePayload.final_diagnosis = hisExam.final_diagnosis.trim();
    if (hisExam.hpi !== undefined && hisExam.hpi !== null)
      updatePayload.hpi = hisExam.hpi.trim();
    if (hisExam.pmh !== undefined && hisExam.pmh !== null)
      updatePayload.pmh = hisExam.pmh.trim();
    if (hisExam.pe !== undefined && hisExam.pe !== null)
      updatePayload.pe = hisExam.pe;

    if (visitSession) {
      if (Object.keys(updatePayload).length > 0) {
        const updated = await this.prismaService.visit_Session.update({
          where: { visit_session_id: visitSession.visit_session_id },
          data: updatePayload,
        });

        this.logger.log(
          `Đã đồng bộ cập nhật bệnh án HIS thành công vào Visit_Session ${updated.visit_session_id} cho bệnh nhân ${patient.full_name} (${patient.citizen_id})`,
        );
        return updated;
      }
      return visitSession;
    } else {
      const created = await this.prismaService.visit_Session.create({
        data: {
          patient_id: patientId,
          visit_date: hisExam.visit_date
            ? new Date(hisExam.visit_date)
            : new Date(),
          ...updatePayload,
        },
      });

      this.logger.log(
        `Đã tạo mới Visit_Session ${created.visit_session_id} và đồng bộ dữ liệu HIS cho bệnh nhân ${patient.full_name} (${patient.citizen_id})`,
      );
      return created;
    }
  }

  async syncByCitizenIdFromWebhook(
    citizenId: string,
    hisData?: any,
  ) {
    const patient = await this.prismaService.patient.findUnique({
      where: { citizen_id: citizenId },
    });

    if (!patient) {
      this.logger.warn(
        `Webhook HIS: Không tìm thấy bệnh nhân nào trong TriageFlow với CCCD: ${citizenId}`,
      );
      return null;
    }

    return this.syncPatientExamFromHis(
      patient.patient_id,
      undefined,
      hisData,
    );
  }

  /**
   * Tự động đẩy / đồng bộ dữ liệu phiên khám từ TriageFlow sang hệ thống HIS
   */
  async pushVisitSessionToHis(visitSessionId: string) {
    try {
      const session = await this.prismaService.visit_Session.findUnique({
        where: { visit_session_id: visitSessionId },
        include: { patient: true },
      });

      if (!session || !session.patient || !session.patient.citizen_id) {
        return null;
      }

      const citizenId = session.patient.citizen_id;
      const latestHisExam =
        await this.fetchLatestExamFromHisByCitizenId(citizenId);

      const payload: Record<string, any> = {};
      if (
        session.chief_complaint !== null &&
        session.chief_complaint !== undefined
      ) {
        payload.chief_complaint = session.chief_complaint.trim();
      }
      if (session.heart_rate !== null && session.heart_rate !== undefined) {
        payload.heart_rate = Number(session.heart_rate);
      }
      if (
        session.blood_pressure_sys !== null &&
        session.blood_pressure_sys !== undefined
      ) {
        payload.blood_pressure_sys = Number(session.blood_pressure_sys);
      }
      if (
        session.blood_pressure_dia !== null &&
        session.blood_pressure_dia !== undefined
      ) {
        payload.blood_pressure_dia = Number(session.blood_pressure_dia);
      }
      if (session.temperature !== null && session.temperature !== undefined) {
        payload.temperature = Number(session.temperature);
      }
      if (session.spo2 !== null && session.spo2 !== undefined) {
        payload.spo2 = Number(session.spo2);
      }
      if (session.diagnosis !== null && session.diagnosis !== undefined) {
        payload.diagnosis = session.diagnosis.trim();
      }
      if (
        session.final_diagnosis !== null &&
        session.final_diagnosis !== undefined
      ) {
        payload.final_diagnosis = session.final_diagnosis.trim();
      }
      if (session.hpi !== null && session.hpi !== undefined) {
        payload.hpi = session.hpi.trim();
      }
      if (session.pmh !== null && session.pmh !== undefined) {
        payload.pmh = session.pmh.trim();
      }
      if (session.pe !== null && session.pe !== undefined) {
        payload.pe = session.pe;
      }
      if (
        session.patient?.allergy_notes !== null &&
        session.patient?.allergy_notes !== undefined
      ) {
        payload.allergy_notes = session.patient.allergy_notes.trim();
      }
      if (
        session.patient?.blood_type !== null &&
        session.patient?.blood_type !== undefined
      ) {
        payload.blood_type = session.patient.blood_type.trim();
      }

      if (latestHisExam && latestHisExam.id) {
        // Cập nhật bệnh án đã có trên HIS
        const url = `${this.hisBaseUrl}/api/exam-his/${latestHisExam.id}`;
        const response = await firstValueFrom(
          this.httpService.patch(url, payload, { timeout: 5000 }),
        );
        this.logger.log(
          `Đã tự động đồng bộ cập nhật từ TriageFlow sang HIS cho bệnh nhân ${session.patient.full_name} (${citizenId})`,
        );
        return response?.data;
      } else {
        // Tạo mới bệnh án trên HIS nếu chưa tồn tại
        const url = `${this.hisBaseUrl}/api/exam-his`;
        const response = await firstValueFrom(
          this.httpService.post(
            url,
            { citizen_id: citizenId, ...payload },
            { timeout: 5000 },
          ),
        );
        this.logger.log(
          `Đã tự động tạo mới và đồng bộ bệnh án sang HIS cho bệnh nhân ${session.patient.full_name} (${citizenId})`,
        );
        return response?.data;
      }
    } catch (error: any) {
      this.logger.warn(
        `Không thể đồng bộ tự động sang HIS cho phiên khám ${visitSessionId}: ${error.message}`,
      );
      return null;
    }
  }
}