import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/config/prisma.service';
import { QueueRebalanceService } from '../queue/queue-rebalance.service';
import {
  BookingStatusEnum,
  FlowStatusEnum,
  InvoiceStatusEnum,
  PaymentStatusEnum,
  PrescriptionStatusEnum,
  ServiceOrderDetailStatusEnum,
  ServiceOrderStatusEnum,
  StepStatusEnum,
} from '@prisma/client';
import { formatInTimeZone, toDate } from 'date-fns-tz';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly queueRebalanceService: QueueRebalanceService,
  ) {}

  @Cron('1 0 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async updateFlowAndStepExpired() {
    const timeZone = 'Asia/Ho_Chi_Minh';
    const now = new Date();
    const todayDateString = formatInTimeZone(now, timeZone, 'yyyy-MM-dd');
    const startOfDay = toDate(`${todayDateString}T00:00:00`, { timeZone });

    return this.prismaService.$transaction(async (tx) => {
      const expiredFlows = await tx.flow.findMany({
        where: {
          booking: {
            slot: {
              shift: {
                date: {
                  lt: startOfDay,
                },
              },
            },
          },
          status: {
            in: ['PENDING', 'IN_PROGRESS'],
          },
        },
        select: {
          flow_id: true,
          booking_id: true,
        },
      });

      const flowIds = expiredFlows.map((f) => f.flow_id);
      const bookingIds = expiredFlows
        .map((f) => f.booking_id)
        .filter((id) => id != null);

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

      if (bookingIds.length > 0) {
        await tx.booking.updateMany({
          where: {
            booking_id: {
              in: bookingIds,
            },
          },
          data: {
            status: BookingStatusEnum.CANCELLED,
          },
        });

        await tx.service_Order.updateMany({
          where: {
            booking_id: { in: bookingIds },
            status: {
              in: [
                ServiceOrderStatusEnum.PENDING,
                ServiceOrderStatusEnum.IN_PROGRESS,
              ],
            },
          },
          data: {
            status: ServiceOrderStatusEnum.CANCELLED,
            payment_status: PaymentStatusEnum.CANCELLED,
          },
        });

        const affectedServiceOrders = await tx.service_Order.findMany({
          where: { booking_id: { in: bookingIds } },
          select: { service_order_id: true },
        });
        const serviceOrderIds = affectedServiceOrders.map(
          (so) => so.service_order_id,
        );

        if (serviceOrderIds.length > 0) {
          await tx.service_Order_Detail.updateMany({
            where: {
              service_order_id: { in: serviceOrderIds },
              status: {
                in: [
                  ServiceOrderDetailStatusEnum.PENDING,
                  ServiceOrderDetailStatusEnum.IN_PROGRESS,
                ],
              },
            },
            data: { status: ServiceOrderDetailStatusEnum.CANCELLED },
          });

          await tx.invoice.updateMany({
            where: {
              service_order_id: { in: serviceOrderIds },
              status: InvoiceStatusEnum.PENDING,
            },
            data: { status: InvoiceStatusEnum.CANCELLED },
          });

          await tx.transaction.updateMany({
            where: {
              service_order_id: { in: serviceOrderIds },
              status: 'PENDING',
            },
            data: { status: PaymentStatusEnum.CANCELLED },
          });
        }
      }

      return {
        message: 'Cập nhật Flow và Step quá hạn thành công',
        updatedCount: flowResult.count,
      };
    });
  }

  @Cron('*/1 * * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async updateTransactionStatus() {
    const currentDate = new Date();
    currentDate.setMinutes(currentDate.getMinutes() - 15); // Quá hạn 15 phút

    const expiredTransactions = await this.prismaService.transaction.findMany({
      where: {
        transDate: { lte: currentDate },
        status: 'PENDING',
      },
      select: { docNo: true },
    });

    const expiredFlows = await this.prismaService.flow.findMany({
      where: {
        status: FlowStatusEnum.PENDING,
        created_at: { lt: currentDate },
      },
      include: { booking: true },
    });

    const docNos = expiredTransactions.map((t) => t.docNo);

    if (docNos.length === 0 && expiredFlows.length === 0) {
      return {
        message: 'Không có Transaction hoặc Flow nào quá hạn cần cập nhật',
        updatedTransactionCount: 0,
        updatedFlowCount: 0,
      };
    }

    let updatedTransactionCount = 0;

    if (docNos.length > 0) {
      const updatedTransactions =
        await this.prismaService.transaction.updateMany({
          where: { docNo: { in: docNos } },
          data: { status: PaymentStatusEnum.CANCELLED },
        });
      updatedTransactionCount = updatedTransactions.count;
    }

    if (expiredFlows.length > 0) {
      for (const flow of expiredFlows) {
        await this.prismaService.$transaction(async (tx) => {
          await tx.flow.update({
            where: { flow_id: flow.flow_id },
            data: { status: FlowStatusEnum.CANCELLED },
          });

          if (flow.booking?.slot_id) {
            await tx.slot.update({
              where: { slot_id: flow.booking.slot_id },
              data: { capacity: { increment: 1 } },
            });
          }

          if (flow.booking_id) {
            await tx.booking.update({
              where: { booking_id: flow.booking_id },
              data: { status: BookingStatusEnum.CANCELLED },
            });

            await tx.service_Order.updateMany({
              where: {
                booking_id: flow.booking_id,
                status: {
                  in: [
                    ServiceOrderStatusEnum.PENDING,
                    ServiceOrderStatusEnum.IN_PROGRESS,
                  ],
                },
              },
              data: {
                status: ServiceOrderStatusEnum.CANCELLED,
                payment_status: PaymentStatusEnum.CANCELLED,
              },
            });

            // Get Service Order IDs to cancel details, invoices and transactions
            const affectedOrders = await tx.service_Order.findMany({
              where: { booking_id: flow.booking_id },
              select: { service_order_id: true },
            });
            const sOrderIds = affectedOrders.map((so) => so.service_order_id);

            if (sOrderIds.length > 0) {
              await tx.service_Order_Detail.updateMany({
                where: {
                  service_order_id: { in: sOrderIds },
                  status: {
                    in: [
                      ServiceOrderDetailStatusEnum.PENDING,
                      ServiceOrderDetailStatusEnum.IN_PROGRESS,
                    ],
                  },
                },
                data: { status: ServiceOrderDetailStatusEnum.CANCELLED },
              });

              await tx.invoice.updateMany({
                where: {
                  service_order_id: { in: sOrderIds },
                  status: InvoiceStatusEnum.PENDING,
                },
                data: { status: InvoiceStatusEnum.CANCELLED },
              });

              await tx.transaction.updateMany({
                where: {
                  service_order_id: { in: sOrderIds },
                  status: 'PENDING',
                },
                data: { status: PaymentStatusEnum.CANCELLED },
              });
            }
          }
        });
      }
    }

    return {
      message: 'Cập nhật quá hạn thành công',
      updatedTransactionCount: updatedTransactionCount,
      updatedFlowCount: expiredFlows.length,
    };
  }
  // @Cron('59 23 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async updatePrescriptionExpired() {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const expiredPrescriptions = await this.prismaService.prescription.findMany(
      {
        where: {
          created_at: {
            lte: oneDayAgo,
          },
          status: PrescriptionStatusEnum.PENDING,
        },
        select: {
          prescription_id: true,
        },
      },
    );

    const prescriptionIds = expiredPrescriptions.map((p) => p.prescription_id);

    if (prescriptionIds.length === 0) {
      return {
        message: 'Không có đơn thuốc nào quá hạn 1 ngày cần cập nhật',
        updatedCount: 0,
      };
    }

    const result = await this.prismaService.prescription.updateMany({
      where: {
        prescription_id: {
          in: prescriptionIds,
        },
      },
      data: {
        status: PrescriptionStatusEnum.EXPIRED,
      },
    });

    return {
      message: 'Cập nhật đơn thuốc quá hạn thành EXPIRED thành công',
      updatedCount: result.count,
    };
  }

  @Cron('50 23 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async cancelTodayQueueEntries() {
    const timeZone = 'Asia/Ho_Chi_Minh';
    const now = new Date();
    const todayDateString = formatInTimeZone(now, timeZone, 'yyyy-MM-dd');
    const startOfDay = toDate(`${todayDateString}T00:00:00`, { timeZone });

    await this.prismaService.queue.updateMany({
      where: {
        created_at: {
          gte: startOfDay,
        },
        status: {
          in: ['PENDING', 'QUEUED', 'CALLED', 'SERVING', 'MISSING'],
        },
      },
      data: {
        status: 'CANCELLED',
      },
    });
  }

  async handleRebalanceDetector() {
    try {
      await this.queueRebalanceService.detectAndSuggest();
    } catch (err: any) {
      this.logger.warn(`Failed handleRebalanceDetector cron: ${err.message}`);
    }
  }
}
