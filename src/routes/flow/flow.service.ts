import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateFlowDto } from './dto/create-flow.dto';
import { UpdateFlowDto } from './dto/update-flow.dto';
import type { IFlowRepository } from '../../shared/interfaces/i-flow.repository';

@Injectable()
export class FlowService {
  constructor(
    @Inject('IFlowRepository') private readonly flowRepository: IFlowRepository,
  ) {}

  

  async findAll() {
    const data = await this.flowRepository.findAll();
    return {
      code: 200,
      message: 'Thành công',
      status: 'success',
      data: data,
    };
  }

  async findOne(flow_id: string) {
    const data = await this.flowRepository.findById(flow_id);
    if (!data) {
      throw new NotFoundException({
        message: 'Không tìm thấy flow',
        detail: `Không tìm thấy flow với id ${flow_id}`,
      });
    }
    return {
      code: 200,
      message: 'Thành công',
      status: 'success',
      data: data,
    };
  }

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

  async findAllByAccountId(account_id: string) {
    const data = await this.flowRepository.findAllByAccountId(account_id);

    return {
      code: 200,
      message: 'Thành công',
      status: 'success',
      data: data,
    };
  }
}
