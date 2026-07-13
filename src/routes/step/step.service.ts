import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateDependencyReqDto,
  CreateParentStepReqDto,
  CreateSubStepReqDto,
} from './dto/req-step.dto';
import type { IStepRepository } from '../../shared/interfaces/i-step.repository';
import { StepStatusEnum } from '@prisma/client';
import { StepErrors } from '../../shared/exceptions/step.exceptions';

@Injectable()
export class StepService {
  constructor(
    @Inject('IStepRepository') private readonly stepRepository: IStepRepository,
  ) {}

  async createParentStep(createParentStepReqDto: CreateParentStepReqDto) {
    const data = await this.stepRepository.createParentStep(
      createParentStepReqDto,
    );

    return {
      code: '200',
      status: 'success',
      message: 'Tạo bước thành công',
      data: data,
    };
  }

  async createSubStep(createSubStepReqDto: CreateSubStepReqDto) {
    const data = await this.stepRepository.createSubStep(createSubStepReqDto);

    return {
      code: '200',
      status: 'success',
      message: 'Tạo bước thành công',
      data: data,
    };
  }

  async createDependency(createDependencyReqDto: CreateDependencyReqDto) {
    const data = await this.stepRepository.createDependency(
      createDependencyReqDto.waiting_step_id,
      createDependencyReqDto.waiting_step_id,
    );

    return {
      code: '200',
      status: 'success',
      message: 'Tạo liên kết bước thành công',
      data: data,
    };
  }


  async findByIdAndAccountId(account_id: string, id: string) {
    const data = await this.stepRepository.findByIdAndAccountId(account_id, id);

    if (!data) {
      throw StepErrors.StepNotFoundByIdAndAccountId(account_id,id);
    }
    return {
      code: 200,
      status: 'success',
      message: 'Lấy bước thành công',
      data: data,
    };
  }
  async findById(id: string) {
    const data = await this.stepRepository.findById(id);

    if (!data) {
      throw StepErrors.StepNotFoundById(id);
    }
    return {
      code: 200,
      status: 'success',
      message: 'Lấy bước thành công',
      data: data,
    };
  }

  async completeStep(stepId: string) {
    const currentStep = await this.stepRepository.findById(stepId);

    if (!currentStep) {
      throw new NotFoundException('Bước này không tồn tại trên hệ thống.');
    }

    if (currentStep.step_status === StepStatusEnum.COMPLETED) {
      return {
        code: '200',
        message: 'Bước này đã được hoàn thành từ trước.',
        status: 'success',
      };
    }

    await this.stepRepository.update(stepId, {
      step_status: StepStatusEnum.COMPLETED,
    });

    if (currentStep.parent_step_id) {
      await this.checkAndCompleteParentStep(currentStep.parent_step_id);
    } else {
      await this.unlockNextSteps(stepId);
    }
  }

  private async checkAndCompleteParentStep(parentId: string) {
    const siblings = await this.stepRepository.findSubStepsByParentId(parentId);

    const isAllSubStepsDone = siblings.every(
      (sub) => sub.step_status === StepStatusEnum.COMPLETED,
    );

    if (isAllSubStepsDone) {
      await this.stepRepository.update(parentId, {
        step_status: StepStatusEnum.COMPLETED,
      });

      await this.unlockNextSteps(parentId);
    }
  }

  private async unlockNextSteps(completedStepId: string) {
    const nextSteps =
      await this.stepRepository.findDependentSteps(completedStepId);
    for (const nextStep of nextSteps) {
      const prerequisites = await this.stepRepository.findDependenciesOfStep(
        nextStep.step_id,
      );

      const isReadyToStart = prerequisites.every(
        (pre) => pre.step_status === StepStatusEnum.COMPLETED,
      );

      if (isReadyToStart && nextStep.step_status === StepStatusEnum.PENDING) {
        await this.stepRepository.update(nextStep.step_id, {
          step_status: StepStatusEnum.IN_PROGRESS,
        });
      }
    }
  }
}
