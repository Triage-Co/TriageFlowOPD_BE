import { Inject, Injectable } from '@nestjs/common';
import { CreateParentStepReqDto, CreateSubStepReqDto } from './dto/req-step.dto';
import type { IStepRepository } from '../../shared/interfaces/i-step.repository';

@Injectable()
export class StepService {

  constructor(@Inject("IStepRepository") private readonly stepRepository: IStepRepository) { }

  async createParentStep(createParentStepReqDto: CreateParentStepReqDto) {

    const data = await this.stepRepository.createParentStep(createParentStepReqDto)

    return {
      code: "200",
      status: "success",
      message: "Tạo bước thành công",
      data: data
    }
  }
  async createSubStep(createSubStepReqDto: CreateSubStepReqDto) {

    const data = await this.stepRepository.createSubStep(createSubStepReqDto)

    return {
      code: "200",
      status: "success",
      message: "Tạo bước thành công",
      data: data
    }
  }

  findAll() {
    return `This action returns all step`;
  }

  findOne(id: number) {
    return `This action returns a #${id} step`;
  }


  remove(id: number) {
    return `This action removes a #${id} step`;
  }
}
