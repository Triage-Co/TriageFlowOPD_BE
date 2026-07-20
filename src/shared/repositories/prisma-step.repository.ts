import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { IStepRepository } from '../interfaces/i-step.repository';
import { Step } from '@prisma/client';

@Injectable()
export class PrismaStepRepository implements IStepRepository {
  constructor(private readonly prismaService: PrismaService) {}
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
    return this.prismaService.step_Dependency.findMany({
      where: {
        depends_on_step_id: stepId,
      },
    });
  }
  findDependenciesOfStep(stepId: string): Promise<any> {
    return this.prismaService.step_Dependency.findMany({
      where: {
        step_id: stepId,
      },
    });
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

  createParentStep(data: any): Promise<any> {
    return this.prismaService.step.create({
      data: {
        flow_id: data.flow_id,
        room_id: data.room_id,
        step_status: 'PENDING',
        staff_id: data.staff_id,
      },
    });
  }

  createSubStep(data: any): Promise<any> {
    return this.prismaService.step.create({
      data: {
        parent_step_id: data.parent_step_id,
        room_id: data.room_id,
        step_status: 'PENDING',
        staff_id: data.staff_id,
      },
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
