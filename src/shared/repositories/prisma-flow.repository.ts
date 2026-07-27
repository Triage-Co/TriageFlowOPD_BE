import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { IFlowRepository } from '../interfaces/i-flow.repository';
import { Flow, Prisma } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';



const findQuery = {
  steps: {
    include: {
      dependedBy: true, //bước yêu cầu hoàn thành (sub step)
      dependencies: true, //bước cần hoàn thành
      queues: true,
      room: {
        include: {
          specialty: true,
        },
      },
      staff: {
        include: {
          account: true,
        },
      },
    },
  },
};

@Injectable()
export class PrismaFlowRepository implements IFlowRepository {
  constructor(private readonly prismaService: PrismaService) {}
  create(
    data: Prisma.FlowUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Flow> {
    const db = tx || this.prismaService;

    return db.flow.create({
      data,
    });
  }
  async findIsActiveByPatientId(patient_id: string): Promise<any> {
    const rawFlow = await this.prismaService.flow.findMany({
      where: {
        status: {
          in: ['IN_PROGRESS'],
        },
        booking: {
          patient_id: patient_id,
        },
      },
      include: findQuery,
    });

    return rawFlow.map((f) => this.formatFlowResponse(f));
  }

  async findAllByPatientId(patient_id: string): Promise<any> {
    const rawFlow = await this.prismaService.flow.findMany({
      where: {
        booking: {
          patient_id: patient_id,
        },
      },
      include: findQuery,
    });

    return rawFlow.map((f) => this.formatFlowResponse(f));
  }

  async findAll(): Promise<any> {
    const rawFlow = await this.prismaService.flow.findMany({
      include: findQuery,
    });

    return rawFlow.map((f) => this.formatFlowResponse(f));
  }

  async findByFlowId(flow_id: string): Promise<any> {
    const rawFlow = await this.prismaService.flow.findUnique({
      where: {
        flow_id: flow_id,
      },
      include: findQuery,
    });

    if (!rawFlow) {
      throw new NotFoundException();
    }

    const formattedSteps = rawFlow.steps.map((step) => {
      return {
        step_id: step.step_id,
        flow_id: step.flow_id,
        room_id: step.room_id,
        staff_id: step.staff_id,
        step_status: step.step_status,
        docNo: step.docNo,
        room_info: step.room
          ? {
              room_name: step.room.room_name,
              room_id: step.room.room_id,
            }
          : null,
        specialty_info:
          step.room && step.room.specialty
            ? {
                specialty_name: step.room?.specialty.specialty_name,
                specialty_id: step.room?.specialty.specialty_id,
              }
            : null,
        staff_info: step.staff
          ? {
              staff_id: step.staff.staff_id,
              full_name: step.staff.full_name || 'N/A',
            }
          : null,
        payment_status: step.payment_status,
        parent_step_id: step.parent_step_id,
        physicalRoomId: step.physicalRoomId,
        depends_on: step.dependencies.map((d: any) => d.depends_on_step_id), //bước cần hoàn thành
        sub_steps: [],
        queues: step.queues || [],
      };
    });

    const stepMap = new Map<string, any>();
    const rootSteps: any[] = [];

    formattedSteps.forEach((step) => stepMap.set(step.step_id, step));

    formattedSteps.forEach((step) => {
      if (step.parent_step_id) {
        const parentNode = stepMap.get(step.parent_step_id);
        if (parentNode) {
          parentNode.sub_steps.push(step);
        } else {
          rootSteps.push(step);
        }
      } else {
        rootSteps.push(step);
      }
    });

    const currentProcessingSteps = (rawFlow.steps as any)
      .filter((s: any) => s.step_status === 'IN_PROGRESS')
      .map((s: any) => s.step_id);

   const timeZone = "Asia/Ho_Chi_Minh";
  const createAt = formatInTimeZone(rawFlow.created_at, timeZone, "yyyy-MM-dd'T'HH:mm:ss");
    return {
      flow_id: rawFlow.flow_id,
      booking_id: rawFlow.booking_id,
      status: rawFlow.status,
      create_at: createAt,
      current_processing_steps: currentProcessingSteps,
      steps: rootSteps, 
    };
  }

  private formatFlowResponse(rawFlow: any) {
    if (!rawFlow) return null;

    const formattedSteps = rawFlow.steps.map((step: any) => {
      return {
        step_id: step.step_id,
        flow_id: step.flow_id,
        room_id: step.room_id,
        staff_id: step.staff_id,
        step_status: step.step_status,
        docNo: step.docNo,
        room_info: step.room
          ? {
              room_name: step.room.room_name,
              room_id: step.room.room_id,
            }
          : null,
        specialty_info:
          step.room && step.room.specialty
            ? {
                specialty_name: step.room.specialty.specialty_name,
                specialty_id: step.room.specialty.specialty_id,
              }
            : null,
        staff_info: step.staff
          ? {
              staff_id: step.staff.staff_id,
              full_name: step.staff.full_name || 'N/A',
            }
          : null,
        payment_status: step.payment_status,
        parent_step_id: step.parent_step_id,
        physicalRoomId: step.physicalRoomId,
        depends_on: step.dependencies.map((d: any) => d.depends_on_step_id), //bước cần hoàn thành
        sub_steps: [],
        queues: step.queues || [],
      };
    });

    const stepMap = new Map<string, any>();
    const rootSteps: any[] = [];

    formattedSteps.forEach((step) => stepMap.set(step.step_id, step));

    formattedSteps.forEach((step) => {
      if (step.parent_step_id) {
        const parentNode = stepMap.get(step.parent_step_id);
        if (parentNode) {
          parentNode.sub_steps.push(step);
        } else {
          rootSteps.push(step);
        }
      } else {
        rootSteps.push(step);
      }
    });

    const currentProcessingSteps = (rawFlow.steps as any)
      .filter((s: any) => s.step_status === 'IN_PROGRESS')
      .map((s: any) => s.step_id);

      const timeZone = "Asia/Ho_Chi_Minh";
const createAt = formatInTimeZone(rawFlow.created_at, timeZone, "yyyy-MM-dd'T'HH:mm:ss");

    return {
      flow_id: rawFlow.flow_id,
      booking_id: rawFlow.booking_id,
      status: rawFlow.status,
      create_at: createAt,
      current_processing_steps: currentProcessingSteps,
      steps: rootSteps,
    };
  }
}
