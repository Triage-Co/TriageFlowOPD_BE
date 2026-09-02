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
import { GroqService } from '../../shared/config/groq.service';

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
    private readonly groqService: GroqService,
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
      let englishText = parseDto.question?.trim() || '';

      // Bước 1: Dịch câu hỏi/mô tả triệu chứng của người dùng (tiếng Việt -> tiếng Anh) cho Infermedica /parse
      if (parseDto.question && parseDto.question.trim().length > 0) {
        const promptTranslateToEn = `You are an expert medical translator specializing in converting Vietnamese patient clinical complaints (including unaccented text, typing shortcuts, typos, and colloquial expressions) into concise, accurate English medical text for NLP parsing (Infermedica).

CORE PRINCIPLES:
1. DIACRITICS & TYPO RESTORATION (Tiếng Việt không dấu & gõ tắt):
   Patients frequently type quickly without tone marks or with abbreviations. Dynamically restore the clinical meaning based on medical context:
   - "dau" + [body part] means "đau" (pain/ache in that anatomical area), e.g., "dau chan" = leg pain, "dau tay" = arm pain, "dau bung" = abdominal pain, "dau lung" = back pain, "dau hong" = sore throat. Only "dau dau" / "nhuc dau" means headache.
   - "moi" means "mỏi" (fatigue / tiredness / soreness), e.g., "moi co" = muscle fatigue / soreness, "moi vai gay" = neck/shoulder stiffness.
   - Typo shortcuts: "ti bi" / "toi bi" / "e bi" = "tôi bị" (I have / suffering from), "ko" / "k" = "không" (no / not).
   - Other common complaints: "sot" (fever), "kho tho" (shortness of breath), "chong mat" (dizziness), "buon non" (nausea), "tieu chay" (diarrhea), "mat ngu" (insomnia).
2. DURATION & SEVERITY:
   Strictly preserve timeframes and durations (e.g., "10 ngay" -> "for 10 days", "tu sang" -> "since morning", "2 tuan" -> "for 2 weeks").
3. NEGATIONS:
   Strictly preserve negations (e.g., "khong sot" / "không sốt" -> "no fever", "k ho" -> "no cough").
4. CLEAN OUTPUT:
   Return ONLY the translated English symptom statement. No quotes, explanations, or formatting.`;

        try {
          const groqEn = await this.groqService
            .groqInstance()
            .chat.completions.create({
              messages: [
                {
                  role: 'system',
                  content: promptTranslateToEn,
                },
                {
                  role: 'user',
                  content: parseDto.question,
                },
              ],
              model: 'qwen/qwen3.8-27b',
              temperature: 0.1,
            });

          const aiTranslated = groqEn.choices[0]?.message?.content?.trim();
          if (aiTranslated) {
            englishText = aiTranslated.replace(/^["']|["']$/g, '').trim();
          }
        } catch (aiError) {
          console.error(
            'Lỗi khi dịch câu hỏi sang tiếng Anh qua Groq AI:',
            aiError,
          );
          englishText = parseDto.question;
        }
      }

      if (englishText.length > 2048) {
        englishText = englishText.slice(0, 2048);
      }

      // Bước 2: Gửi sang Infermedica /parse với text tiếng Anh
      const parsePayload: Record<string, any> = {
        text: englishText,
        age: {
          value: parseDto.age,
        },
      };

      if (parseDto.sex) {
        parsePayload.sex = parseDto.sex;
      }

      const { data } = await firstValueFrom(
        this.httpService.post('/parse', parsePayload),
      );

      let translatedData = data;

      // Bước 3: Dịch dữ liệu phản hồi từ Infermedica (tiếng Anh -> tiếng Việt) tương tự như diagnosis
      if (data && Array.isArray(data.mentions) && data.mentions.length > 0) {
        const promptTranslateToVi = `Bạn là một bác sĩ chuyên khoa giàu kinh nghiệm và là một dịch giả y khoa chuyên nghiệp. Nhiệm vụ của bạn là dịch toàn bộ dữ liệu phản hồi (Response JSON) từ API phân tích triệu chứng y khoa (Infermedica /parse) từ tiếng Anh sang tiếng Việt.

PHẠM VI DỊCH THUẬT (Chỉ dịch giá trị của các trường sau trong mảng "mentions"):
1. \`name\`: Tên y khoa chuẩn xác của triệu chứng hoặc yếu tố nguy cơ (ví dụ: "Pain in lower limb" -> "Đau chi dưới", "Muscle weakness" -> "Yếu mỏi cơ", "Abdominal pain" -> "Đau bụng", "Headache" -> "Đau đầu", "Fever" -> "Sốt", "Diagnosed diabetes" -> "Đã chẩn đoán đái tháo đường").
2. \`common_name\`: Tên gọi thông thường, phổ biến và dễ hiểu cho người bệnh (ví dụ: "Pain in lower limb" -> "Đau chân", "Weak muscles" -> "Mỏi cơ / Yếu cơ", "sore throat" -> "đau họng").
3. \`orth\`: Cụm từ triệu chứng tương ứng với ngữ cảnh người bệnh mô tả (ví dụ: "leg pain" -> "đau chân", "muscle fatigue for 10 days" -> "mỏi cơ trong 10 ngày").

YÊU CẦU CHUYÊN MÔN Y KHOA (BẮT BUỘC):
1. Từ vựng chuẩn y khoa Việt Nam:
   - "Diabetes" -> "Đái tháo đường" (không dùng tiểu đường).
   - "High blood pressure" / "Hypertension" -> "Tăng huyết áp".
   - "Dyspnea" / "Shortness of breath" -> "Khó thở".
   - "Fatigue" -> "Mệt mỏi".
   - Các từ chỉ mức độ: "Mild / Moderate / Severe" -> "Nhẹ / Vừa / Nặng".
2. Dịch chính xác nghĩa lâm sàng, tự nhiên, không dịch máy móc word-by-word.

QUY TẮC BẢO TOÀN CẤU TRÚC JSON (NGHIÊM NGẶT):
1. BẢO TOÀN TẤT CẢ KEYS: Không được đổi tên bất kỳ key nào trong JSON (giữ nguyên 'mentions', 'id', 'orth', 'choice_id', 'name', 'common_name', 'type', 'obvious'...).
2. BẢO TOÀN TẤT CẢ IDs & ENUMS: TUYỆT ĐỐI KHÔNG ĐƯỢC DỊCH các giá trị định danh và cờ hệ thống:
   - Giữ nguyên \`id\` (ví dụ: "s_13", "s_102", "p_8", "s_650"...).
   - Giữ nguyên \`choice_id\` (ví dụ: "present", "absent", "unknown").
   - Giữ nguyên \`type\` (ví dụ: "symptom", "risk_factor").
   - Giữ nguyên cờ hệ thống \`obvious\` (true / false).
3. ĐẦU RA BẮT BUỘC:
   - Trả về DUY NHẤT một chuỗi JSON hợp lệ.
   - KHÔNG bọc trong markdown (\`\`\`json).
   - KHÔNG thêm bất kỳ câu chào hỏi hay giải thích nào ở đầu và cuối.`;

        try {
          const groqVi = await this.groqService
            .groqInstance()
            .chat.completions.create({
              messages: [
                {
                  role: 'system',
                  content: promptTranslateToVi,
                },
                {
                  role: 'user',
                  content: JSON.stringify(data),
                },
              ],
              model: 'qwen/qwen3.8-27b',
              temperature: 0.1,
              response_format: { type: 'json_object' },
            });

          let aiResponseString = groqVi.choices[0]?.message?.content || '{}';
          aiResponseString = aiResponseString
            .replace(/^```json\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
          const parsed = JSON.parse(aiResponseString);
          if (
            parsed &&
            typeof parsed === 'object' &&
            Array.isArray(parsed.mentions)
          ) {
            translatedData = parsed;
          }
        } catch (aiError) {
          console.error('Lỗi khi dịch phản hồi /parse qua Groq AI:', aiError);
          translatedData = data;
        }
      }

      return {
        code: 200,
        message: 'Trả kết quả thành công',
        status: 'success',
        data: translatedData,
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

      console.log(currentTurn);
      console.log(numberOfDiagnoses);
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
      let translatedQuestionObject = data.question;

      if (data.question) {
        const promptSystem = `Bạn là một bác sĩ chuyên khoa giàu kinh nghiệm và là một dịch giả y khoa chuyên nghiệp. Nhiệm vụ của bạn là dịch toàn bộ dữ liệu phản hồi (Response JSON) từ API Chẩn đoán y khoa (Infermedica /diagnosis) từ tiếng Anh sang tiếng Việt.

PHẠM VI DỊCH THUẬT (Chỉ dịch giá trị của các trường sau):
1. Trong phần "question": Dịch các trường \`text\` (Câu hỏi), \`name\` (Tên triệu chứng/thuộc tính), \`label\` (Nhãn lựa chọn: Yes/No/Don't know -> Có/Không/Không biết).
2. Nếu có \`explication\` (giải thích) và \`instruction\` (hướng dẫn đo khám), phải dịch chuẩn xác, dễ hiểu để bệnh nhân tự thực hiện được.
3. Trong phần "conditions": Dịch \`name\` (Tên y khoa của bệnh) và \`common_name\` (Tên thông thường của bệnh). Dịch \`hint\` (nếu có trong \`condition_details\`).

YÊU CẦU CHUYÊN MÔN Y KHOA (BẮT BUỘC):
1. Văn phong: Tự nhiên, ân cần nhưng chuyên nghiệp, giống như bác sĩ đang trực tiếp khám bệnh. Tuyệt đối không dịch word-by-word.
2. Từ vựng chuẩn y khoa:
   - "Diabetes" -> "Đái tháo đường" (không dùng tiểu đường).
   - "High blood pressure" / "Hypertension" -> "Tăng huyết áp".
   - Các từ chỉ mức độ: "How severe/strong..." -> "Mức độ... như thế nào?". "Mild / Moderate / Severe" -> "Nhẹ / Vừa / Nặng".
   - "Pulsing or throbbing" -> "Đau thành nhịp hoặc đau nhói".
3. Câu hỏi tiền sử bệnh: Nếu có "Have you been diagnosed with..." hoặc "history of...", bắt buộc dịch là "Bạn có tiền sử mắc... không?".
4. Câu hỏi thời gian (duration): Nếu câu hỏi về thời gian (How long...), dịch là "Triệu chứng [tên triệu chứng] đã kéo dài bao lâu?".

QUY TẮC BẢO TOÀN CẤU TRÚC JSON (NGHIÊM NGẶT):
1. BẢO TOÀN TẤT CẢ KEYS: Không được đổi tên bất kỳ key nào trong JSON (giữ nguyên 'id', 'type', 'text', 'items', 'choices', 'conditions', 'probability', 'extras'...).
2. BẢO TOÀN TẤT CẢ IDs & ENUMS: KHÔNG ĐƯỢC DỊCH các giá trị id/system.
   - Giữ nguyên \`id\` (ví dụ: "s_98", "c_130", "present", "absent", "unknown").
   - Giữ nguyên \`type\` (ví dụ: "single", "group_single", "group_multiple", "duration").
   - Giữ nguyên \`unit\` (ví dụ: "day", "week", "month", "year").
   - Giữ nguyên các flag hệ thống ("should_stop": false, "has_emergency_evidence": false).
3. ĐẦU RA BẮT BUỘC:
   - Trả về DUY NHẤT một chuỗi JSON hợp lệ.
   - KHÔNG bọc trong markdown (\`\`\`json).
   - KHÔNG thêm bất kỳ câu chào hỏi hay giải thích nào ở đầu và cuối.`;

        try {
          const groq = await this.groqService
            .groqInstance()
            .chat.completions.create({
              messages: [
                {
                  role: 'system',
                  content: promptSystem,
                },
                {
                  role: 'user',
                  content: JSON.stringify(data.question),
                },
              ],
              model: 'qwen/qwen3.8-27b',
              temperature: 0.1,
              response_format: { type: 'json_object' },
            });

          let aiResponseString = groq.choices[0]?.message?.content || '{}';
          aiResponseString = aiResponseString
            .replace(/^```json\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
          const parsed = JSON.parse(aiResponseString);
          if (
            parsed &&
            typeof parsed === 'object' &&
            Object.keys(parsed).length > 0
          ) {
            translatedQuestionObject = parsed;
          }
        } catch (aiError) {
          console.error('Lỗi khi dịch câu hỏi qua Groq AI:', aiError);
          translatedQuestionObject = data.question;
        }
      }
      return {
        code: 200,
        message: 'Thành công',
        status: 'success',
        data: {
          ...data,
          question: translatedQuestionObject,
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
            include_pro: false,
            types: 'symptom',
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
