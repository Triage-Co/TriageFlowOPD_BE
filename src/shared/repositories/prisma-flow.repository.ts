import { Injectable } from '@nestjs/common';
import { IRoomRepository } from '../interfaces/i-room.repository';
import { PrismaService } from '../config/prisma.service';
import { IFlowRepository } from '../interfaces/i-flow.repository';

const flowIncludeQuery = {
  steps: {
    include: {
      dependencies: true,
      room: true,
      sub_step: {
        include: {
          room: true,
          dependencies: true,
        },
      },
      parent_step: {
        include: {
          room: true,
          dependencies: true,
        },
      },
    },
  },
};

@Injectable()
export class PrismaFlowRepository implements IFlowRepository {
  constructor(private readonly prismaService: PrismaService) {}


  findAll(): Promise<any> {
    return this.prismaService.flow.findMany({
      include: flowIncludeQuery
    });
  }

  findById(flow_id: string): Promise<any> {
    return this.prismaService.flow.findUnique({
      where: {
        flow_id: flow_id,
      },
      
    });
  }
  findAllByAccountId(account_id: string): Promise<any> {
    return this.prismaService.flow.findMany({
      where: {
        booking: {
          patient: {
            account_id: account_id,
          },
        },
      },
      include: flowIncludeQuery,
    });
  }
  findByStepId(account_id: string, id: string): Promise<any> {
    return this.prismaService.flow.findFirst({
      where: {
        steps: {
          some: {
            step_id: id,
          },
        },
        booking: {
          patient: {
            account_id: account_id,
          },
        },
      },
      include: flowIncludeQuery,
    });
  }
}
