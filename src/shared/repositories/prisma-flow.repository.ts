import { Injectable } from '@nestjs/common';
import { IRoomRepository } from '../interfaces/i-room.repository';
import { PrismaService } from '../config/prisma.service';
import { IFlowRepository } from '../interfaces/i-flow.repository';

@Injectable()
export class PrismaFlowRepository implements IFlowRepository {
  constructor(private readonly prismaService: PrismaService) {}
  findAll(account_id: string): Promise<any> {
    return this.prismaService.flow.findMany({
      where: {
        booking: {
          patient: {
            account_id: account_id,
          },
        },
      },
      include: {
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
      },
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
      include: {
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
      },
    });
  }
}
