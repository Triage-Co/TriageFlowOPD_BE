import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateFlowDto } from './dto/create-flow.dto';
import { UpdateFlowDto } from './dto/update-flow.dto';
import type { IFlowRepository } from '../../shared/interfaces/i-flow.repository';

@Injectable()
export class FlowService {
  constructor(
    @Inject('IFlowRepository') private readonly flowRepository: IFlowRepository,
  ) {}
  async findOneByStepId(account_id: string, id: string) {
    const data = await this.flowRepository.findByStepId(account_id, id);
    if (!data) {
      throw new NotFoundException({
        message: 'Không tìm thấy flow',
        detail: `Không tìm thấy flow với id ${id}`,
      });
    }

    return {
      code: 200,
      message: 'Thành công',
      status: 'success',
      data: data,
    };
  }

  async findAll(account_id: string) {
    const data = await this.flowRepository.findAll(account_id);


    return {
      code: 200,
      message: 'Thành công',
      status: 'success',
      data: data,
    };
  }
}
