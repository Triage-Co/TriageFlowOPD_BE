import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, NotAcceptableException } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { TriageDto, ParseDto, SearchDto } from './dto/infermedica.dto';
import type { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../shared/config/prisma.service';
import { AuthError } from '@supabase/supabase-js';
import { AuthErrors } from '../../shared/exceptions/auth.exceptions';

@Injectable()
export class InfermedicaService {
  PATIENT_ANSWER: PrismaClient['patient_Answer'];
  ACCOUNT: PrismaClient['account'];
  PATIENT: PrismaClient['patient'];
  TRIAGE_INFO: PrismaClient['triage_Information'];
  SPECIALTY: PrismaClient['specialty'];

  constructor(
    private readonly httpService: HttpService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly prismaService: PrismaService,
  ) {
    this.PATIENT_ANSWER = prismaService.patient_Answer;
    this.ACCOUNT = prismaService.account;
    this.PATIENT = prismaService.patient;
    this.TRIAGE_INFO = prismaService.triage_Information;
    this.SPECIALTY = prismaService.specialty;
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
      const configRecord = await this.prismaService.triage_Config.findFirst({
        where: {
          rule_key: 'DIAGNOSIS_CONFIG',
        },
      });

      let numberOfDiagnoses = 5;

      if (configRecord && configRecord.rule_value) {
        const ruleValue = configRecord.rule_value as any;
        if (ruleValue.number_of_diagnosis) {
          numberOfDiagnoses = ruleValue.number_of_diagnosis;
        }
      }

      const currentToken = interview_token || `new_session_${Date.now()}`;

      const cacheKey = `interview_${currentToken}`;

      let currentTurn = await this.cacheManager.get<number>(cacheKey);

      if (!currentTurn) {
        currentTurn = interview_token ? 1 : 0;
      }

      const { data } = await firstValueFrom(
        this.httpService.post('/diagnosis', {
          sex: triageDto.sex,
          age: {
            value: triageDto.age,
          },
          evidence: triageDto.evidence,
        }),
      );

      currentTurn += 1;
      await this.cacheManager.set(cacheKey, currentTurn, 3600000);

      const isOverLimit = currentTurn >= numberOfDiagnoses;

      const finalToken = interview_token || currentToken;

      await this.PATIENT_ANSWER.upsert({
        where: {
          interview_token: finalToken,
        },
        update: {
          questionnaire_data: triageDto as unknown as Prisma.InputJsonObject,
        },
        create: {
          citizen_id: citizen_id,
          patient_id: existedPatient.patient_id,
          questionnaire_data: triageDto as unknown as Prisma.InputJsonObject,
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
      const { data } = await firstValueFrom(
        this.httpService.post('/triage', {
          sex: triageDto.sex,
          age: {
            value: triageDto.age,
          },
          evidence: triageDto.evidence,
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

      const { data } = await firstValueFrom(
        this.httpService.post('/recommend_specialist', {
          sex: triageDto.sex,
          age: {
            value: triageDto.age,
          },
          evidence: triageDto.evidence,
        }),
      );

      const specialty_code = data.recommended_specialist.id || 'SP_1';

      const exitedSpecialty = await this.SPECIALTY.findFirst({
        where: {
          specialty_code: {
            equals: specialty_code,
            mode: 'insensitive',
          },
        },
      });

      const exitedPatientInfo = await this.TRIAGE_INFO.findFirst({
        where: {
          answer_id: exitedPatientAnswer.patient_answer_id,
        },
      });

      if (exitedSpecialty) {
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
}
