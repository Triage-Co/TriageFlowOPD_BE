import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateDependencyReqDto,
  UpdateDependencyReqDto,
  CreateParentStepReqDto,
  CreateSubStepReqDto,
  FindByIdAndPatientIdReqDto,
  UpdateStepReqDto,
  UpdateStepStatusReqDto,
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
      createDependencyReqDto.required_step_id,
    );

    return {
      code: '200',
      status: 'success',
      message: 'Tạo liên kết bước thành công',
      data: data,
    };
  }

  async updateDependency(updateDependencyReqDto: UpdateDependencyReqDto) {
    const data = await this.stepRepository.updateDependency(
      updateDependencyReqDto.waiting_step_id,
      updateDependencyReqDto.old_required_step_id,
      updateDependencyReqDto.new_required_step_id,
    );

    return {
      code: '200',
      status: 'success',
      message: 'Cập nhật liên kết bước thành công',
      data: data,
    };
  }

  async findByIdAndAccountId(account_id: string, id: string) {
    const data = await this.stepRepository.findByIdAndAccountId(account_id, id);
    if (!data) {
      throw StepErrors.StepNotFoundByIdAndAccountId(account_id, id);
    }
    return {
      code: 200,
      status: 'success',
      message: 'Lấy bước thành công',
      data: data,
    };
  }

  async findByIdAndPatientId(step_id: string, patient_id: string) {
    const data = await this.stepRepository.findStepByIdAndPatientId(
      step_id,
      patient_id,
    );

    if (!data) {
      throw StepErrors.StepNotFoundByIdAndPatientId(patient_id, step_id);
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

  async updateStep(stepId: string, updateData: UpdateStepReqDto) {
    const currentStep = await this.stepRepository.findById(stepId);
    if (!currentStep) {
      throw new NotFoundException('Bước này không tồn tại trên hệ thống.');
    }

    const updatedStep = await this.stepRepository.update(stepId, updateData);

    return {
      code: 200,
      status: 'success',
      message: 'Cập nhật thông tin bước thành công',
      data: updatedStep,
    };
  }

  async updateStepStatus(
    stepId: string,
    updateStatusDto: UpdateStepStatusReqDto,
  ) {
    const currentStep = await this.stepRepository.findById(stepId);
    if (!currentStep) {
      throw new NotFoundException('Bước này không tồn tại trên hệ thống.');
    }

    if (updateStatusDto.step_status === StepStatusEnum.COMPLETED) {
      await this.completeStep(stepId);
      return {
        code: 200,
        status: 'success',
        message: 'Đã hoàn thành bước và cập nhật tiến trình.',
      };
    }

    const updatedStep = await this.stepRepository.update(stepId, {
      step_status: updateStatusDto.step_status,
    });

    return {
      code: 200,
      status: 'success',
      message: 'Cập nhật trạng thái bước thành công',
      data: updatedStep,
    };
  }

  async findPendingPaymentStepsByPatientId(patientId: string) {
    const steps =
      await this.stepRepository.findPendingPaymentStepsByPatientId(patientId);
    return {
      code: 200,
      status: 'success',
      message: 'Lấy danh sách các bước thành công',
      data: steps,
    };
  }
}
