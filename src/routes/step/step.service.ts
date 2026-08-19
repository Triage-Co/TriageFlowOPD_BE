import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateDependencyReqDto,
  UpdateDependencyReqDto,
  CreateParentStepReqDto,
  CreateSubStepReqDto,
  UpdateStepReqDto,
  UpdateStepStatusReqDto,
} from './dto/req-step.dto';
import type { IStepRepository } from '../../shared/interfaces/i-step.repository';
import {
  QueueTypeEnum,
  StepStatusEnum,
  StepTypeEnum,
  FlowStatusEnum,
} from '@prisma/client';
import { StepErrors } from '../../shared/exceptions/step.exceptions';
import { QueueService } from '../queue/queue.service';
import { PrismaService } from '../../shared/config/prisma.service';

const CLS_TYPES = new Set([
  StepTypeEnum.LAB_TEST,
  StepTypeEnum.IMAGING,
  StepTypeEnum.PROCEDURE,
  StepTypeEnum.FUNCTIONAL_EXPLORATION,
]);

function isStepSatisfied(status: StepStatusEnum): boolean {
  return (
    status === StepStatusEnum.COMPLETED || status === StepStatusEnum.DECLINED
  );
}

@Injectable()
export class StepService {
  constructor(
    @Inject('IStepRepository') private readonly stepRepository: IStepRepository,

    @Inject(forwardRef(() => QueueService))
    private readonly queueService: QueueService,
    private readonly prisma: PrismaService,
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

  /**
   * Complete a step and unlock dependents. Optionally skip closing SERVING queue
   * when QueueService already handles that in the same flow.
   */
  async completeStep(
    stepId: string,
    options?: { skipCloseServingQueue?: boolean },
  ) {
    const currentStep = await this.stepRepository.findById(stepId);

    if (!currentStep) {
      throw new NotFoundException('Bước này không tồn tại trên hệ thống.');
    }

    if (currentStep.step_status === StepStatusEnum.COMPLETED) {
      return {
        code: 200,
        message: 'Bước này đã được hoàn thành từ trước.',
        status: 'success',
        data: currentStep,
      };
    }

    if (
      currentStep.step_status === StepStatusEnum.DECLINED ||
      currentStep.step_status === StepStatusEnum.CANCELLED
    ) {
      throw new BadRequestException(
        'Không thể hoàn thành bước đã từ chối hoặc đã hủy.',
      );
    }

    await this.stepRepository.update(stepId, {
      step_status: StepStatusEnum.COMPLETED,
    });

    if (currentStep.parent_step_id) {
      await this.checkAndCompleteParentStep(currentStep.parent_step_id);
    } else {
      await this.unlockNextSteps(stepId, StepStatusEnum.COMPLETED);
    }

    if (!options?.skipCloseServingQueue) {
      await this.queueService.closeServingQueueByStepId(stepId, 'complete');
    }

    if (currentStep.flow_id) {
      await this.checkAndCompleteFlow(currentStep.flow_id);
    }

    const updated = await this.stepRepository.findById(stepId);
    return {
      code: 200,
      status: 'success',
      message: 'Đã hoàn thành bước và cập nhật tiến trình.',
      data: updated,
    };
  }

  /**
   * Decline a step (staff refuse). Prerequisites treat DECLINED as satisfied.
   * Does not enqueue RETURNING.
   */
  async declineStep(
    stepId: string,
    options?: { skipCloseServingQueue?: boolean; reason?: string },
  ) {
    const currentStep = await this.stepRepository.findById(stepId);

    if (!currentStep) {
      throw new NotFoundException('Bước này không tồn tại trên hệ thống.');
    }

    if (currentStep.step_status === StepStatusEnum.DECLINED) {
      return {
        code: 200,
        status: 'success',
        message: 'Bước này đã được từ chối từ trước.',
        data: currentStep,
      };
    }

    if (currentStep.step_status === StepStatusEnum.COMPLETED) {
      throw new BadRequestException('Không thể từ chối bước đã hoàn thành.');
    }

    await this.stepRepository.update(stepId, {
      step_status: StepStatusEnum.DECLINED,
    });

    if (currentStep.parent_step_id) {
      await this.checkAndCompleteParentStep(currentStep.parent_step_id);
    } else {
      await this.unlockNextSteps(stepId, StepStatusEnum.DECLINED);
    }

    if (!options?.skipCloseServingQueue) {
      await this.queueService.closeServingQueueByStepId(
        stepId,
        'refuse',
        options?.reason,
      );
    }

    if (currentStep.flow_id) {
      await this.checkAndCompleteFlow(currentStep.flow_id);
    }

    const updated = await this.stepRepository.findById(stepId);
    return {
      code: 200,
      status: 'success',
      message: 'Đã từ chối bước và mở khóa bước phụ thuộc (nếu có).',
      data: updated,
    };
  }

  private async checkAndCompleteParentStep(parentId: string) {
    const siblings = await this.stepRepository.findSubStepsByParentId(parentId);

    const isAllSubStepsDone = siblings.every((sub) =>
      isStepSatisfied(sub.step_status),
    );

    if (isAllSubStepsDone) {
      const anyCompleted = siblings.some(
        (sub) => sub.step_status === StepStatusEnum.COMPLETED,
      );
      await this.stepRepository.update(parentId, {
        step_status: anyCompleted
          ? StepStatusEnum.COMPLETED
          : StepStatusEnum.DECLINED,
      });

      await this.unlockNextSteps(
        parentId,
        anyCompleted ? StepStatusEnum.COMPLETED : StepStatusEnum.DECLINED,
      );
    }
  }

  /**
   * @param triggerStatus status of the step that just finished (COMPLETED or DECLINED)
   */
  private async unlockNextSteps(
    completedStepId: string,
    triggerStatus: StepStatusEnum,
  ) {
    const completedStep = await this.stepRepository.findById(completedStepId);
    const nextSteps =
      await this.stepRepository.findDependentSteps(completedStepId);

    for (const nextStep of nextSteps) {
      const prerequisites = await this.stepRepository.findDependenciesOfStep(
        nextStep.step_id,
      );

      const isReadyToStart = prerequisites.every((pre) =>
        isStepSatisfied(pre.step_status),
      );

      if (isReadyToStart && nextStep.step_status === StepStatusEnum.PENDING) {
        await this.stepRepository.update(nextStep.step_id, {
          step_status: StepStatusEnum.IN_PROGRESS,
        });

        // RETURNING only when unlocked by a real CLS completion (not decline)
        const unlockedByCompletedCls =
          triggerStatus === StepStatusEnum.COMPLETED &&
          ((completedStep?.step_type &&
            CLS_TYPES.has(completedStep.step_type)) ||
            prerequisites.some(
              (pre) =>
                pre.step_type &&
                CLS_TYPES.has(pre.step_type) &&
                pre.step_status === StepStatusEnum.COMPLETED,
            ));

        if (unlockedByCompletedCls && nextStep.room_id) {
          try {
            await this.queueService.enqueueStep(
              nextStep.step_id,
              QueueTypeEnum.RETURNING,
              undefined,
              { forceType: true },
            );
          } catch (err: any) {
            console.error(
              `Failed to enqueue RETURNING for step ${nextStep.step_id}:`,
              err?.message || err,
            );
          }
        }
      }
    }
  }

  async updateStep(stepId: string, updateData: UpdateStepReqDto) {
    const currentStep = await this.prisma.step.findUnique({
      where: { step_id: stepId },
      include: { flow: true },
    });
    if (!currentStep) {
      throw new NotFoundException('Bước này không tồn tại trên hệ thống.');
    }
    const flowStatus = currentStep.flow?.status;
    if (
      flowStatus &&
      flowStatus !== FlowStatusEnum.IN_PROGRESS &&
      flowStatus !== FlowStatusEnum.PENDING
    ) {
      throw new BadRequestException(
        'Không thể cập nhật Step vì flow hiện tại không ở trạng thái IN_PROGRESS hoặc PENDING',
      );
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
    const currentStep = await this.prisma.step.findUnique({
      where: { step_id: stepId },
      include: { flow: true },
    });
    if (!currentStep) {
      throw new NotFoundException('Bước này không tồn tại trên hệ thống.');
    }
    const flowStatus = currentStep.flow?.status;
    if (
      flowStatus &&
      flowStatus !== FlowStatusEnum.IN_PROGRESS &&
      flowStatus !== FlowStatusEnum.PENDING
    ) {
      throw new BadRequestException(
        'Không thể cập nhật trạng thái Step vì flow hiện tại không ở trạng thái IN_PROGRESS hoặc PENDING',
      );
    }

    if (updateStatusDto.step_status === StepStatusEnum.COMPLETED) {
      return this.completeStep(stepId);
    }

    if (updateStatusDto.step_status === StepStatusEnum.DECLINED) {
      return this.declineStep(stepId);
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

  async checkAndCompleteFlow(flowId: string) {
    if (!flowId) return;
    const unfinishedSteps = await this.prisma.step.count({
      where: {
        flow_id: flowId,
        step_status: {
          notIn: [
            StepStatusEnum.COMPLETED,
            StepStatusEnum.DECLINED,
            StepStatusEnum.CANCELLED,
          ],
        },
      },
    });

    if (unfinishedSteps === 0) {
      await this.prisma.flow.update({
        where: { flow_id: flowId },
        data: { status: FlowStatusEnum.COMPLETED },
      });
    }
  }
}
