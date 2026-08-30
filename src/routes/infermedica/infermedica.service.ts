import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, NotAcceptableException } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { TriageDto, ParseDto, SearchDto } from './dto/infermedica.dto';
import type { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../shared/config/prisma.service';
import { AuthErrors } from '../../shared/exceptions/auth.exceptions';
import { AiSpecialtyService } from '../ai-specialty/ai-specialty.service';
import { UpdateQuestionLimitDto } from './dto/triage-config.dto';
import { formatInTimeZone, toDate } from 'date-fns-tz';
import type { ISlotRepository } from '../../shared/interfaces/i-slot.repository';

@Injectable()
export class InfermedicaService {
  PATIENT_ANSWER: PrismaClient['patient_Answer'];
  ACCOUNT: PrismaClient['account'];
  PATIENT: PrismaClient['patient'];
  TRIAGE_INFO: PrismaClient['triage_Information'];
  SPECIALTY: PrismaClient['specialty'];
  TRIAGE_CONFIG: PrismaClient['triage_Config'];

  constructor(
    private readonly httpService: HttpService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly prismaService: PrismaService,
    private readonly aiSpecialtyService: AiSpecialtyService,
    @Inject('ISlotRepository')
    private readonly slotRepository: ISlotRepository,
  ) {
    this.PATIENT_ANSWER = prismaService.patient_Answer;
    this.ACCOUNT = prismaService.account;
    this.PATIENT = prismaService.patient;
    this.TRIAGE_INFO = prismaService.triage_Information;
    this.SPECIALTY = prismaService.specialty;
    this.TRIAGE_CONFIG = prismaService.triage_Config;
  }

  private static readonly DIAGNOSIS_CONFIG_KEY = 'DIAGNOSIS_CONFIG';
  private static readonly DEFAULT_NUMBER_OF_DIAGNOSIS = 5;

  private readNumberOfDiagnosis(ruleValue: unknown): number {
    if (!ruleValue || typeof ruleValue !== 'object') {
      return InfermedicaService.DEFAULT_NUMBER_OF_DIAGNOSIS;
    }

    const value = ruleValue as Record<string, unknown>;
    const raw = value.number_of_diagnosis ?? value.number_of_diagnoise;

    return typeof raw === 'number' && raw > 0
      ? raw
      : InfermedicaService.DEFAULT_NUMBER_OF_DIAGNOSIS;
  }

  async parse(parseDto: ParseDto) {
    try {
      const { data } = await firstValueFrom(
        this.httpService.post('/parse', {
          text: parseDto.question,
          age: {
            value: parseDto.age,
          },
        }),
      );

      return {
        code: 200,
        message: 'Trả kết quả thành công',
        status: 'success',
        data: data,
      };
    } catch (error) {
      return {
        code: 401,
        status: 'error',
        message: 'Đã xảy ra lỗi',
        detail: error,
      };
    }
  }

  async diagnosis(
    triageDto: TriageDto,
    citizen_id: string,
    interview_token?: string,
  ) {
    const existedPatient = await this.PATIENT.findFirst({
      where: {
        citizen_id: citizen_id,
      },
    });
    if (!existedPatient) {
      throw AuthErrors.PatientNotFoundByCitizenId(citizen_id);
    }

    try {
      const configRecord = await this.TRIAGE_CONFIG.findFirst({
        where: {
          rule_key: InfermedicaService.DIAGNOSIS_CONFIG_KEY,
        },
      });
      const numberOfDiagnoses = this.readNumberOfDiagnosis(
        configRecord?.rule_value,
      );

      const currentToken = interview_token || `new_session_${Date.now()}`;
      const finalToken = interview_token || currentToken;

      const cacheKey = `interview_${currentToken}`;
      const lastQuestionKey = `last_question_${finalToken}`;

      let currentTurn = await this.cacheManager.get<number>(cacheKey);
      if (!currentTurn) {
        currentTurn = 1;
      }

      const lastQuestion: any = await this.cacheManager.get(lastQuestionKey);

      let cleanedEvidence = [...(triageDto.evidence || [])];
      if (lastQuestion && lastQuestion.type === 'group_single') {
        const groupItemIds = new Set(
          lastQuestion.items?.map((item: any) => item.id) || [],
        );
        cleanedEvidence = cleanedEvidence.filter((e) => {
          if (groupItemIds.has(e.id)) {
            return e.choice_id === 'present';
          }
          return true;
        });
      }

      const evidenceForApi = cleanedEvidence.map((item) => ({
        id: item.id,
        choice_id: item.choice_id,
      }));

      const { data } = await firstValueFrom(
        this.httpService.post('/diagnosis', {
          sex: triageDto.sex,
          age: {
            value: triageDto.age,
          },
          evidence: evidenceForApi,
        }),
      );

      const isOverLimit = currentTurn >= numberOfDiagnoses;
      await this.cacheManager.set(cacheKey, currentTurn + 1, 3600000);

      const existingAnswer = await this.PATIENT_ANSWER.findUnique({
        where: {
          interview_token: finalToken,
        },
      });

      let questionnaireData: any = existingAnswer?.questionnaire_data;
      if (
        !questionnaireData ||
        typeof questionnaireData !== 'object' ||
        Array.isArray(questionnaireData)
      ) {
        questionnaireData = {
          sex: triageDto.sex,
          age: triageDto.age,
          history: [],
          evidence: [],
        };
      }
      if (!Array.isArray(questionnaireData.history)) {
        questionnaireData.history = [];
      }

      if (lastQuestion) {
        const qType = lastQuestion.type;

        if (qType === 'single') {
          const item = lastQuestion.items?.[0];
          const matchedEv = cleanedEvidence.find((e) => e.id === item?.id);
          const choiceId = matchedEv?.choice_id || 'unknown';
          const choiceMeta = item?.choices?.find((c: any) => c.id === choiceId);

          questionnaireData.history.push({
            turn: currentTurn,
            question_type: 'single',
            question_text: lastQuestion.text,
            answer: {
              id: item?.id,
              name: item?.name || matchedEv?.name,
              choice_id: choiceId,
              choice_label: choiceMeta?.label || choiceId,
            },
          });
        } else if (qType === 'group_single') {
          const selectedEvidence = cleanedEvidence.find(
            (e) =>
              lastQuestion.items?.some((item: any) => item.id === e.id) &&
              e.choice_id === 'present',
          );
          const selectedItem = lastQuestion.items?.find(
            (item: any) => item.id === selectedEvidence?.id,
          );

          questionnaireData.history.push({
            turn: currentTurn,
            question_type: 'group_single',
            question_text: lastQuestion.text,
            answer: selectedItem
              ? {
                  id: selectedItem.id,
                  name: selectedItem.name,
                  choice_id: 'present',
                }
              : {
                  id: null,
                  name: 'Không rõ / Không chọn',
                  choice_id: 'unknown',
                },
          });
        } else if (qType === 'group_multiple') {
          const selectedItems = lastQuestion.items
            ?.map((item: any) => {
              const ev = cleanedEvidence.find((e) => e.id === item.id);
              if (!ev) return null;
              const choiceMeta = item.choices?.find(
                (c: any) => c.id === ev.choice_id,
              );
              return {
                id: item.id,
                name: item.name,
                choice_id: ev.choice_id,
                choice_label: choiceMeta?.label || ev.choice_id,
              };
            })
            .filter(Boolean);

          questionnaireData.history.push({
            turn: currentTurn,
            question_type: 'group_multiple',
            question_text: lastQuestion.text,
            answers: selectedItems || [],
          });
        } else {
          questionnaireData.history.push({
            turn: currentTurn,
            question_type: qType,
            question_text: lastQuestion.text,
            evidence: cleanedEvidence,
          });
        }
      } else {
        const hasTurn1 = questionnaireData.history.some(
          (h: any) => h.turn === 1,
        );
        if (!hasTurn1) {
          questionnaireData.history.push({
            turn: 1,
            question_type: 'initial',
            question_text: 'Khai báo triệu chứng ban đầu',
            answers: cleanedEvidence,
          });
        }
      }

      questionnaireData.sex = triageDto.sex;
      questionnaireData.age = triageDto.age;
      questionnaireData.evidence = cleanedEvidence;

      if (data.question) {
        await this.cacheManager.set(lastQuestionKey, data.question, 3600000);
      } else {
        await this.cacheManager.del(lastQuestionKey);
      }

      await this.PATIENT_ANSWER.upsert({
        where: {
          interview_token: finalToken,
        },
        update: {
          questionnaire_data:
            questionnaireData as unknown as Prisma.InputJsonObject,
        },
        create: {
          citizen_id: citizen_id,
          patient_id: existedPatient.patient_id,
          questionnaire_data:
            questionnaireData as unknown as Prisma.InputJsonObject,
          interview_token: finalToken,
        },
      });
      return {
        code: 200,
        message: 'Thành công',
        status: 'success',
        data: {
          ...data,
          question: data.question,
          ...(interview_token && { interview_token: interview_token }),
          should_stop: isOverLimit || !data.question,
        },
      };
    } catch (error) {
      return {
        code: 401,
        status: 'error',
        message: 'Đã xảy ra lỗi',
        detail: error,
      };
    }
  }

  async triage(triageDto: TriageDto) {
    try {
      const evidenceForApi = triageDto.evidence?.map((item) => ({
        id: item.id,
        choice_id: item.choice_id,
      }));

      const { data } = await firstValueFrom(
        this.httpService.post('/triage', {
          sex: triageDto.sex,
          age: {
            value: triageDto.age,
          },
          evidence: evidenceForApi,
        }),
      );

      return {
        code: 200,
        message: 'Thành công',
        status: 'success',
        data: data,
      };
    } catch (error) {
      return {
        code: 401,
        status: 'error',
        message: 'Đã xảy ra lỗi',
        detail: error,
      };
    }
  }

  async recommendSpecialist(triageDto: TriageDto, interview_token: string) {
    try {
      const exitedPatientAnswer = await this.PATIENT_ANSWER.findUnique({
        where: {
          interview_token: interview_token,
        },
      });

      if (!exitedPatientAnswer) {
        throw new NotAcceptableException({
          message: 'Không tìm thấy interview token',
          detail: `Không tìm thấy interview token trong hệ thống`,
        });
      }

      const evidenceForApi = triageDto.evidence?.map((item) => ({
        id: item.id,
        choice_id: item.choice_id,
      }));

      const { data } = await firstValueFrom(
        this.httpService.post('/recommend_specialist', {
          sex: triageDto.sex,
          age: {
            value: triageDto.age,
          },
          evidence: evidenceForApi,
        }),
      );

      const specialty_code = data.recommended_specialist.id || 'sp_1';

      const exitedSpecialty =
        await this.aiSpecialtyService.resolveHospitalSpecialtyByAiCode(
          specialty_code,
        );

      const exitedPatientInfo = await this.TRIAGE_INFO.findFirst({
        where: {
          answer_id: exitedPatientAnswer.patient_answer_id,
        },
      });

      let best_slot_id: string | null = null;
      let doctor: string | null = null;
      let room: string | null = null;

      if (exitedSpecialty) {
        const timeZone = 'Asia/Ho_Chi_Minh';
        const now = new Date();
        const currentHours = formatInTimeZone(now, timeZone, 'HH:mm');
        const todayDateString = formatInTimeZone(now, timeZone, 'yyyy-MM-dd');
        const startOfToday = toDate(`${todayDateString}T00:00:00`, {
          timeZone,
        });

        const availableSlots = await this.slotRepository.findAvailableSlots(
          exitedSpecialty.specialty_id,
          currentHours,
          startOfToday,
        );

        if (availableSlots && availableSlots.length > 0) {
          best_slot_id = availableSlots[0].slot_id;
          doctor = availableSlots[0].shift.staff.full_name;
          room = availableSlots[0].shift.room.room_name;
        }

        if (!exitedPatientInfo) {
          await this.TRIAGE_INFO.create({
            data: {
              answer_id: exitedPatientAnswer.patient_answer_id,
              specialty_id: exitedSpecialty.specialty_id,
              interview_token: interview_token,
            },
          });
        } else {
          await this.TRIAGE_INFO.update({
            where: {
              triage_information_id: exitedPatientInfo.triage_information_id,
            },
            data: {
              specialty_id: exitedSpecialty.specialty_id,
            },
          });
        }
      }

      return {
        code: 200,
        message: 'Thành công',
        status: 'success',
        data: {
          recommended_specialist: {
            specialty_id: exitedSpecialty?.specialty_id,
            specialty_code: exitedSpecialty?.specialty_code,
            name: exitedSpecialty?.specialty_name,
          },
          best_slot_id: best_slot_id,
          room: room,
          doctor: doctor,
        },
      };
    } catch (error) {
      return {
        code: 401,
        status: 'error',
        message: 'Đã xảy ra lỗi',
        detail: error,
      };
    }
  }

  async search(searchDto: SearchDto) {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get('/search', {
          params: {
            'age.value': Number(searchDto.age),
            phrase: searchDto.phrase,
            max_results: 999,
          },
        }),
      );

      return {
        code: 200,
        message: 'Thành công',
        status: 'success',
        data: data,
      };
    } catch (error) {
      return {
        code: 401,
        status: 'error',
        message: 'Đã xảy ra lỗi',
        detail: error,
      };
    }
  }

  async getQuestionLimit() {
    try {
      const configRecord = await this.TRIAGE_CONFIG.findFirst({
        where: {
          rule_key: InfermedicaService.DIAGNOSIS_CONFIG_KEY,
        },
      });

      return {
        code: 200,
        message: 'Thành công',
        status: 'success',
        data: {
          number_of_diagnosis: this.readNumberOfDiagnosis(
            configRecord?.rule_value,
          ),
        },
      };
    } catch (error) {
      return {
        code: 400,
        status: 'error',
        message: 'Đã xảy ra lỗi',
        detail: error,
      };
    }
  }

  async updateQuestionLimit(dto: UpdateQuestionLimitDto) {
    try {
      const ruleValue = {
        number_of_diagnosis: dto.number_of_diagnosis,
      };

      const existing = await this.TRIAGE_CONFIG.findFirst({
        where: {
          rule_key: InfermedicaService.DIAGNOSIS_CONFIG_KEY,
        },
      });

      if (existing) {
        await this.TRIAGE_CONFIG.update({
          where: { triage_config: existing.triage_config },
          data: { rule_value: ruleValue },
        });
      } else {
        await this.TRIAGE_CONFIG.create({
          data: {
            rule_key: InfermedicaService.DIAGNOSIS_CONFIG_KEY,
            rule_value: ruleValue,
          },
        });
      }

      return {
        code: 200,
        message: 'Thành công',
        status: 'success',
        data: {
          number_of_diagnosis: dto.number_of_diagnosis,
        },
      };
    } catch (error) {
      return {
        code: 400,
        status: 'error',
        message: 'Đã xảy ra lỗi',
        detail: error,
      };
    }
  }
}
