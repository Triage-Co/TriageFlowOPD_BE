import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, NotAcceptableException } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { TriageDto, ParseDto, SearchDto } from './dto/infermedica.dto';
import type { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../shared/config/prisma.service';

@Injectable()
export class InfermedicaService {
  PATIENT_ANWSER: PrismaClient['patient_Anwser'];
  ACCOUNT: PrismaClient['account'];
  PATIENT: PrismaClient['patient'];
  TRIAGE_INFOR: PrismaClient['triage_Information'];
  SPECIALTY: PrismaClient['specialty'];

  constructor(
    private readonly httpService: HttpService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly prismaService: PrismaService,
  ) {
    this.PATIENT_ANWSER = prismaService.patient_Anwser;
    this.ACCOUNT = prismaService.account;
    this.PATIENT = prismaService.patient;
    this.TRIAGE_INFOR = prismaService.triage_Information;
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

  async diagnoise(
    triageDto: TriageDto,
    citizen_id: string,
    interview_token?: string,
  ) {
    try {
      const configRecord = await this.prismaService.triage_Config.findFirst({
        where: {
          rule_key: 'DIAGNOSIS_CONFIG',
        },
      });

      let numberOfDiagnoise = 5;

      if (configRecord && configRecord.rule_value) {
        const ruleValue = configRecord.rule_value as any;
        if (ruleValue.number_of_diagnoise) {
          numberOfDiagnoise = ruleValue.number_of_diagnoise;
        }
      }

      let interviewId = `new_session_${Date.now()}`;

      if (interview_token) {
        interviewId = interview_token;
      }

      const cacheKey = `interview_turn_${interviewId}`;
      let currentTurn = (await this.cacheManager.get<number>(cacheKey)) || 0;

      if (interview_token) {
        currentTurn = (await this.cacheManager.get<number>(cacheKey)) || 1;
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

      const isOverLimit = currentTurn >= numberOfDiagnoise;

      if (citizen_id) {
        const exitedUser = await this.PATIENT.findUnique({
          where: {
            citizen_id: citizen_id,
          }
        });

        if (!interview_token) {
          if (!exitedUser) {
            await this.PATIENT_ANWSER.create({
              data: {
                citizen_id: citizen_id,
                questionnaire_data:
                  triageDto as unknown as Prisma.InputJsonValue,
                interview_token: data.interview_token || null,
              },
            });
          } else {
            await this.PATIENT_ANWSER.create({
              data: {
                citizen_id: citizen_id,
                patient_id: exitedUser.patient_id,
                questionnaire_data:
                  triageDto as unknown as Prisma.InputJsonObject,
                interview_token: data.interview_token || null,
              },
            });
          }
        } else {
          const exitedInterviewToken = await this.PATIENT_ANWSER.findFirst({
            where: {
              interview_token: interview_token,
            },
          });

          if (!exitedInterviewToken) {
            if (!exitedUser) {
              await this.PATIENT_ANWSER.create({
                data: {
                  citizen_id: citizen_id,
                  questionnaire_data:
                    triageDto as unknown as Prisma.InputJsonValue,
                  interview_token: data.interview_token || null,
                },
              });
            } else {
              await this.PATIENT_ANWSER.create({
                data: {
                  citizen_id: citizen_id,
                  patient_id: exitedUser.account_id,
                  questionnaire_data:
                    triageDto as unknown as Prisma.InputJsonObject,
                  interview_token: data.interview_token || null,
                },
              });
            }
          } else {
            if (!exitedUser) {
              await this.PATIENT_ANWSER.update({
                where: {
                  interview_token: interview_token,
                },
                data: {
                  questionnaire_data:
                    triageDto as unknown as Prisma.InputJsonValue,
                },
              });
            } else {
              await this.PATIENT_ANWSER.update({
                where: {
                  interview_token: interview_token,
                },
                data: {
                  questionnaire_data:
                    triageDto as unknown as Prisma.InputJsonObject,
                },
              });
            }
          }
        }
      }
      return {
        code: 200,
        message: 'Thành công',
        status: 'success',
        data: {
          ...data,
          question: data.question,
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
      const exitedPatientAwser = await this.PATIENT_ANWSER.findUnique({
        where: {
          interview_token: interview_token,
        },
      });

      if (!exitedPatientAwser) {
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

      const exitedPatientInfor = await this.TRIAGE_INFOR.findFirst({
        where: {
          answer_id: exitedPatientAwser.patient_anwser_id,
        },
      });

      if (exitedSpecialty) {
        if (!exitedPatientInfor) {
          await this.TRIAGE_INFOR.create({
            data: {
              answer_id: exitedPatientAwser.patient_anwser_id,
              specialty_id: exitedSpecialty.specialty_id,
              interview_token: interview_token,
            },
          });
        } else {
          await this.TRIAGE_INFOR.update({
            where: {
              triage_information_id: exitedPatientInfor.triage_information_id,
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
            max_results: 999
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
