import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import {
  IStepRepository,
  StepWithBookingAndSlot,
} from '../interfaces/i-step.repository';
import { PaymentStatusEnum, Prisma, Step } from '@prisma/client';

@Injectable()
export class PrismaStepRepository implements IStepRepository {
  constructor(private readonly prismaService: PrismaService) {}
  getById(id: string): Promise<StepWithBookingAndSlot | null> {
    return this.prismaService.step.findUnique({
      where: { step_id: id },
      include: {
        room: true,
        queues: true,
        service_order: {
          include: {
            booking: {
              include: {
                slot: true,
              },
            },
          },
        },
      },
    });
  }
  findPendingPaymentStepsByPatientId(patientId: string): Promise<Step[]> {
    return this.prismaService.step.findMany({
      where: {
        flow: {
          booking: {
            patient_id: patientId,
          },
        },
        step_status: {
          in: ['IN_PROGRESS', 'PENDING'],
        },
      },
    });
  }
  findClinicalStepByServiceOrderId(
    serviceOrderId: string,
  ): Promise<Step | null> {
    return this.prismaService.step.findFirst({
      where: {
        service_order_id: serviceOrderId,
        step_type: 'CLINICAL',
      },
    });
  }
  findPaymentStepByServiceOrderId(
    serviceOrderId: string,
  ): Promise<Step | null> {
    return this.prismaService.step.findFirst({
      where: {
        service_order_id: serviceOrderId,
        step_type: 'PAYMENT',
      },
    });
  }
  findStepByIdAndPatientId(
    stepId: string,
    patientId: string,
  ): Promise<Step | null> {
    return this.prismaService.step.findFirst({
      where: {
        step_id: stepId,
        flow: {
          booking: {
            patient_id: patientId,
          },
        },
      },
      include: {
        queues: true,
        staff: true,
        flow: {
          select: {
            booking: {
              select: {
                slot: {
                  select: {
                    start_time: true,
                    end_time: true,
                    shift: {
                      select: {
                        room: {
                          include: {
                            specialty: true,
                          },
                        },
                        date: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        sub_step: true,
      },
    });
  }

  findByIdAndAccountId(account_id: string, id: string): Promise<any> {
    return this.prismaService.step.findFirst({
      where: {
        step_id: id,
        flow: {
          booking: {
            patient: {
              account_id: account_id,
            },
          },
        },
      },
      omit: {
        flow_id: true,
        staff_id: true,
        room_id: true,
      },
      include: {
        queues: true,
        staff: true,
        flow: {
          select: {
            booking: {
              select: {
                slot: {
                  select: {
                    start_time: true,
                    end_time: true,
                    shift: {
                      select: {
                        room: {
                          include: {
                            specialty: true,
                          },
                        },
                        date: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        sub_step: true,
      },
    });
  }

  findById(id: string): Promise<any> {
    return this.prismaService.step.findUnique({
      where: {
        step_id: id,
      },
      omit: {
        flow_id: true,
        staff_id: true,
        room_id: true,
      },
      include: {
        queues: true,
        staff: true,
        flow: {
          select: {
            booking: {
              select: {
                slot: {
                  select: {
                    start_time: true,
                    end_time: true,
                    shift: {
                      select: {
                        room: {
                          include: {
                            specialty: true,
                          },
                        },
                        date: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        sub_step: true,
      },
    });
  }

  findSubStepsByParentId(parentId: string): Promise<any> {
    return this.prismaService.step.findMany({
      where: {
        parent_step_id: parentId,
      },
    });
  }

  findDependentSteps(stepId: string): Promise<any> {
    return this.prismaService.step_Dependency
      .findMany({
        where: {
          depends_on_step_id: stepId,
        },
        include: {
          step: true,
        },
      })
      .then((deps) => deps.map((d) => d.step));
  }

  findDependenciesOfStep(stepId: string): Promise<any> {
    return this.prismaService.step_Dependency
      .findMany({
        where: {
          step_id: stepId,
        },
        include: {
          dependsOnStep: true,
        },
      })
      .then((deps) => deps.map((d) => d.dependsOnStep));
  }

  createDependency(
    waitingStepId: string,
    requiredStepId: string,
  ): Promise<any> {
    return this.prismaService.step_Dependency.create({
      data: {
        step_id: waitingStepId,
        depends_on_step_id: requiredStepId,
      },
    });
  }

  updateDependency(
    waitingStepId: string,
    oldRequiredStepId: string,
    newRequiredStepId: string,
  ): Promise<any> {
    return this.prismaService.step_Dependency.update({
      where: {
        step_id_depends_on_step_id: {
          step_id: waitingStepId,
          depends_on_step_id: oldRequiredStepId,
        },
      },
      data: {
        depends_on_step_id: newRequiredStepId,
      },
    });
  }

  createParentStep(
    data: Prisma.StepUncheckedCreateWithoutParent_stepInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Step> {
    const db = tx || this.prismaService;
    return db.step.create({
      data,
    });
  }

  createSubStep(
    data: Prisma.StepUncheckedCreateWithoutFlowInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Step> {
    const db = tx || this.prismaService;
    return db.step.create({
      data,
    });
  }

  update(id: string, data: any): Promise<any> {
    return this.prismaService.step.update({
      data: {
        ...data,
      },
      where: {
        step_id: id,
      },
    });
  }

  findAll(): Promise<any> {
    return this.prismaService.step.findMany();
  }

  delete(id: string): Promise<any> {
    return this.prismaService.step.delete({
      where: {
        step_id: id,
      },
    });
  }
}
