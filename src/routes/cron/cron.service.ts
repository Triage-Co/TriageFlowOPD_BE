import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/config/prisma.service';
import { PaymentStatusEnum, StepStatusEnum } from '@prisma/client';

@Injectable()
export class CronService {
  constructor(private readonly prismaService: PrismaService) {}
  async updateFlowAndStepExpired() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    return this.prismaService.$transaction(async (tx) => {
      const expiredFlows = await tx.flow.findMany({
        where: {
          created_at: {
            lt: startOfDay,
          },
          status: {
            in: ['PENDING', 'IN_PROGRESS'],
          },
        },
        select: {
          flow_id: true,
        },
      });

      const flowIds = expiredFlows.map((f) => f.flow_id);

      if (flowIds.length === 0) {
        return {
          message: 'Không có Flow quá hạn',
          updatedCount: 0,
        };
      }

      const flowResult = await tx.flow.updateMany({
        where: {
          flow_id: {
            in: flowIds,
          },
        },
        data: {
          status: 'ABANDONED',
        },
      });

      await tx.step.updateMany({
        where: {
          flow_id: {
            in: flowIds,
          },
          step_status: {
            in: ['PENDING', 'IN_PROGRESS'],
          },
        },
        data: {
          step_status: StepStatusEnum.CANCELLED,
        },
      });

      return {
        message: 'Cập nhật Flow và Step quá hạn thành công',
        updatedCount: flowResult.count,
      };
    });
  }

  async updateTransactionStatus() {
    const currentDate = new Date();
    currentDate.setMinutes(currentDate.getMinutes() - 10);
    const rs = await this.prismaService.transaction.updateMany({
      where: {
        transDate: {
          lte: currentDate,
        },
        status: {
          in: [PaymentStatusEnum.PENDING],
        },
      },
      data: {
        status: PaymentStatusEnum.CANCELLED,
      },
    });
    return {
      message: 'Cập nhật Transaction quá hạn thành công',
      updatedCount: rs.count,
    };
  }
}
