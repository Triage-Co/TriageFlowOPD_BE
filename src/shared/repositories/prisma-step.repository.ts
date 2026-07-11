import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { IStepRepository } from '../interfaces/i-step.repository';

@Injectable()
export class PrismaStepRepository implements IStepRepository {
  constructor(private readonly prismaService: PrismaService) {}
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

  findById(id: string): Promise<any> {
    return this.prismaService.step.findUnique({
      where: {
        step_id: id,
      },
    });
  }

  delete(id: string): Promise<any> {
    return this.prismaService.step.delete({
      where: {
        step_id: id,
      },
    });
  }
}
