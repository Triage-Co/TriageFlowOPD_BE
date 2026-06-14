import { HttpService } from "@nestjs/axios";
import { Injectable } from "@nestjs/common";
import { firstValueFrom } from "rxjs";
import { TriageDto, ParseDto, SearchDto } from "./dto/infermedica.dto";


@Injectable()
export class InfermedicaService {
  constructor(private readonly httpService: HttpService) { }

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

  async diagnoise(triageDto: TriageDto) {
    try {
      const { data } = await firstValueFrom(this.httpService.post("/diagnosis", {
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
