import { HttpService } from "@nestjs/axios";
import { Inject, Injectable } from "@nestjs/common";
import { firstValueFrom } from "rxjs";
import { TriageDto, ParseDto, SearchDto } from "./dto/infermedica.dto";
import type { Cache } from "cache-manager"
import { CACHE_MANAGER } from "@nestjs/cache-manager";

@Injectable()
export class InfermedicaService {
  constructor(private readonly httpService: HttpService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) { }

  async parse(parseDto: ParseDto) {
    try {
      const { data } = await firstValueFrom(this.httpService.post("/parse", {
        "text": parseDto.question,
        "age": {
          "value": parseDto.age
        }
      }))

      return {
        code: 200,
        message: "Trả kết quả thành công",
        status: "success",
        data: data
      }
    } catch (error) {
      return {
        code: 401,
        status: "error",
        message: "Đã xảy ra lỗi",
        detail: error
      }
    }


  }

  async diagnoise(triageDto: TriageDto, numberOfStep: number) {
    try {


      const interviewId = triageDto.interview_id || `new_session_${Date.now()}`;

      const cacheKey = `interview_turn_${interviewId}`;
      let currentTurn = await this.cacheManager.get<number>(cacheKey) || 0;

      const { data } = await firstValueFrom(this.httpService.post("/diagnosis", {
        sex: triageDto.sex,
        age: {
          value: triageDto.age
        },
        evidence: triageDto.evidence
      }
      ))

      currentTurn += 1;
      await this.cacheManager.set(cacheKey, currentTurn, 3600000);

      const isOverLimit = currentTurn >= numberOfStep - 1;

      return {
        code: 200,
        message: "Thành công",
        status: "success",
        data: {
          ...data,
          question: isOverLimit ? null : data.question,
          should_stop: isOverLimit || !data.question,
          interview_id: data.interview_token || interviewId
        }
      }
    } catch (error) {
      return {
        code: 401,
        status: "error",
        message: "Đã xảy ra lỗi",
        detail: error
      }
    }
  }

  async triage(triageDto: TriageDto) {
    try {
      const { data } = await firstValueFrom(this.httpService.post("/triage", {
        sex: triageDto.sex,
        age: {
          value: triageDto.age
        },
        evidence: triageDto.evidence
      }
      ))

      return {
        code: 200,
        message: "Thành công",
        status: "success",
        data: data
      }
    } catch (error) {
      return {
        code: 401,
        status: "error",
        message: "Đã xảy ra lỗi",
        detail: error
      }
    }
  }

  async recommendSpecialist(triageDto: TriageDto) {
    try {
      const { data } = await firstValueFrom(this.httpService.post("/recommend_specialist", {
        sex: triageDto.sex,
        age: {
          value: triageDto.age
        },
        evidence: triageDto.evidence
      }
      ))

      return {
        code: 200,
        message: "Thành công",
        status: "success",
        data: data
      }
    } catch (error) {
      return {
        code: 401,
        status: "error",
        message: "Đã xảy ra lỗi",
        detail: error
      }
    }
  }


  async search(searchDto: SearchDto) {
    try {
      const { data } = await firstValueFrom(this.httpService.get("/search", {
        params: {
          'age.value': searchDto.age,
          phrase: searchDto.phrase
        }
      }
      ))

      return {
        code: 200,
        message: "Thành công",
        status: "success",
        data: data
      }
    } catch (error) {
      return {
        code: 401,
        status: "error",
        message: "Đã xảy ra lỗi",
        detail: error
      }
    }
  }
}
