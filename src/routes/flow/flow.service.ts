import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateFlowDto } from './dto/create-flow.dto';
import { UpdateFlowDto } from './dto/update-flow.dto';
import type { IFlowRepository } from '../../shared/interfaces/i-flow.repository';
import { PrismaService } from '../../shared/config/prisma.service';
import { TemplateStepDto } from '../template/dto/create-template.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class FlowService {
  constructor(
    @Inject('IFlowRepository') private readonly flowRepository: IFlowRepository,
    private readonly prismaService: PrismaService,
  ) {}

  private roundRobinTracker = new Map<string, number>();

  async findAllByPatientId(patient_id: string) {
    const data = await this.flowRepository.findAllByPatientId(patient_id);

    return {
      code: 200,
      message: 'Thành công',
      status: 'success',
      data: data,
    };
  }
  async findIsActiveByPatientId(patient_id: string) {
    const data = await this.flowRepository.findIsActiveByPatientId(patient_id);

    return {
      code: 200,
      message: 'Thành công',
      status: 'success',
      data: data,
    };
  }

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
    const data = await this.flowRepository.findByFlowId(flow_id);
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

  async addTemplateToFlow(flowId: string, templateId: string) {
    const existingFlow = await this.prismaService.flow.findUnique({
      where: { flow_id: flowId },
      include: {
        steps: {
          include: {
            room: true,
          },
        },
        booking: {
          include: {
            slot: {
              include: {
                shift: {
                  include: {
                    room: true,
                    staff: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!existingFlow) {
      throw new NotFoundException(
        'Không tìm thấy Flow hiện tại của bệnh nhân.',
      );
    }

    const specialtyId = existingFlow.booking.slot.shift.room.specialty_id;

    const template = await this.prismaService.flow_Template.findUnique({
      where: { template_id: templateId },
    });
    if (!template) {
      throw new NotFoundException(
        'Không tìm thấy Flow Template được chỉ định.',
      );
    }

    const templateSteps = template.steps as unknown as TemplateStepDto[];
    const idMapping = new Map<string, string>();
    const createdStepIds: string[] = [];

    return this.prismaService.$transaction(
      async (tx) => {
        const saveStepsRecursively = async (
          steps: TemplateStepDto[],
          parentStepId: string | null = null,
        ) => {
          for (const step of steps) {
            const neededSpecialFilter = [
              'CONSULTATION',
              'TREATMENT',
              'TRIAGE',
            ].includes(step.room_type);
            const availableRooms = await tx.room.findMany({
              where: {
                room_type: step.room_type,
                ...(neededSpecialFilter && { specialty_id: specialtyId }),
                shifts: {
                  some: {
                    slots: {
                      some: {
                        capacity: {
                          gt: 0,
                        },
                      },
                    },
                  },
                },
              },
              include: {
                shifts: {
                  where: {
                    slots: {
                      some: {
                        capacity: {
                          gt: 0,
                        },
                      },
                    },
                  },
                  include: {
                    slots: {
                      where: {
                        capacity: {
                          gt: 0,
                        },
                      },
                      orderBy: [{ capacity: 'desc' }, { start_time: 'asc' }],
                    },
                  },
                },
              },
            });

            if (availableRooms.length === 0) {
              throw new Error(
                `Không có phòng hoặc nhân sự nào trống cho dịch vụ: ${step.room_type}`,
              );
            }

            const currentIndex =
              this.roundRobinTracker.get(step.room_type) || 0;

            const selectedRoom =
              availableRooms[currentIndex % availableRooms.length];

            this.roundRobinTracker.set(step.room_type, currentIndex + 1);
            const createdStep = await tx.step.create({
              data: {
                flow_id: flowId,
                step_status: 'PENDING',
                step_name: template.template_name,
                room_id: selectedRoom.room_id,
                staff_id: selectedRoom.shifts[0].staff_id,
                parent_step_id: parentStepId,
                payment_status: step.requires_payment ? 'PENDING' : null,
              },
            });

            idMapping.set(step.template_step_id, createdStep.step_id);
            createdStepIds.push(createdStep.step_id);

            if (step.sub_steps && step.sub_steps.length > 0) {
              await saveStepsRecursively(step.sub_steps, createdStep.step_id);
            }
          }
        };
        await saveStepsRecursively(templateSteps);

        const saveDependenciesRecursively = async (
          steps: TemplateStepDto[],
        ) => {
          for (const step of steps) {
            if (step.depends_on && step.depends_on.length > 0) {
              const stepId = idMapping.get(step.template_step_id);
              for (const requiredStep of step.depends_on) {
                const dependsOnStepId = idMapping.get(requiredStep);

                if (stepId && dependsOnStepId) {
                  await tx.step_Dependency.create({
                    data: {
                      step_id: stepId,
                      depends_on_step_id: dependsOnStepId,
                    },
                  });
                }
              }
            }
            if (step.sub_steps && step.sub_steps.length > 0) {
              await saveDependenciesRecursively(step.sub_steps);
            }
          }
        };

        await saveDependenciesRecursively(templateSteps);

        // for (const stepId of createdStepIds) {
        //   const currentStep = await tx.step.findUnique({
        //     where: { step_id: stepId },
        //     select: { parent_step_id: true },
        //   });

        //   const dependencyCount = await tx.step_Dependency.count({
        //     where: { step_id: stepId },
        //   });

        //   let isReadyToProgress = false;

        //   if (dependencyCount == 0) {
        //     if (!currentStep?.parent_step_id) {
        //       isReadyToProgress = true;
        //     } else {
        //       const parentStep = await tx.step.findUnique({
        //         where: { step_id: currentStep.parent_step_id },
        //         select: { step_status: true },
        //       });

        //       if (parentStep?.step_status === 'IN_PROGRESS') {
        //         isReadyToProgress = true;
        //       }
        //     }
        //   }
        //   if (isReadyToProgress) {
        //     await tx.step.update({
        //       where: { step_id: stepId },
        //       data: { step_status: 'IN_PROGRESS' },
        //     });
        //   }
        // }

        return {
          code: 200,
          status: 'success',
          message: 'Tạo template thành công',
          flow_id: flowId,
        };
      },
      {
        maxWait: 10000,
        timeout: 30000,
      },
    );
  }

  @Cron('59 59 23 * * *', {
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async changeFlowStatus() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    await this.prismaService.flow.updateMany({
      where: {
        status: {
          in: ['IN_PROGRESS', 'PENDING'],
        },
        created_at: {
          lt: startOfToday,
        },
      },
      data: {
        status: 'ABANDONED',
      },
    });
  }
}
