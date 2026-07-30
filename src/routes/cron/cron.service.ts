// import { Injectable } from '@nestjs/common';
// import { PrismaService } from '../../shared/config/prisma.service';
// import { PaymentStatusEnum, StepStatusEnum } from '@prisma/client';
// import { formatInTimeZone, toDate } from 'date-fns-tz';

// @Injectable()
// export class CronService {
//   constructor(private readonly prismaService: PrismaService) {}
//   async updateFlowAndStepExpired() {
//     const timeZone = 'Asia/Ho_Chi_Minh';
//     const now = new Date();
//     const todayDateString = formatInTimeZone(now, timeZone, 'yyyy-MM-dd');
//     const startOfDay = toDate(`${todayDateString}T00:00:00`, { timeZone });

//     return this.prismaService.$transaction(async (tx) => {
//       const expiredFlows = await tx.flow.findMany({
//         where: {
//           created_at: {
//             lt: startOfDay,
//           },
//           status: {
//             in: ['PENDING', 'IN_PROGRESS'],
//           },
//         },
//         select: {
//           flow_id: true,
//         },
//       });

//       const flowIds = expiredFlows.map((f) => f.flow_id);

//       if (flowIds.length === 0) {
//         return {
//           message: 'Không có Flow quá hạn',
//           updatedCount: 0,
//         };
//       }

//       const flowResult = await tx.flow.updateMany({
//         where: {
//           flow_id: {
//             in: flowIds,
//           },
//         },
//         data: {
//           status: 'ABANDONED',
//         },
//       });

//       await tx.step.updateMany({
//         where: {
//           flow_id: {
//             in: flowIds,
//           },
//           step_status: {
//             in: ['PENDING', 'IN_PROGRESS'],
//           },
//         },
//         data: {
//           step_status: StepStatusEnum.CANCELLED,
//         },
//       });

//       return {
//         message: 'Cập nhật Flow và Step quá hạn thành công',
//         updatedCount: flowResult.count,
//       };
//     });
//   }

//   async updateTransactionStatus() {
//     const currentDate = new Date();
//     currentDate.setMinutes(currentDate.getMinutes() - 10);

//     const expiredTransactions = await this.prismaService.transaction.findMany({
//       where: {
//         transDate: {
//           lte: currentDate,
//         },
//         status: 'PENDING',
//       },
//       select: {
//         docNo: true,
//       },
//     });

//     const docNos = expiredTransactions.map((t) => t.docNo);

//     if (docNos.length === 0) {
//       return {
//         message: 'Không có Transaction nào quá hạn cần cập nhật',
//         updatedTransactionCount: 0,
//         updatedStepCount: 0,
//       };
//     }

//     const [updatedTransactions, updatedSteps] =
//       await this.prismaService.$transaction([
//         this.prismaService.transaction.updateMany({
//           where: {
//             docNo: {
//               in: docNos,
//             },
//           },
//           data: {
//             status: PaymentStatusEnum.CANCELLED,
//           },
//         }),
//         this.prismaService.step.updateMany({
//           where: {
//             docNo: {
//               in: docNos,
//             },
//           },
//           data: {
//             step_status: StepStatusEnum.CANCELLED,
//             payment_status: PaymentStatusEnum.CANCELLED,
//           },
//         }),
//       ]);

//     return {
//       message: 'Cập nhật Transaction và Step quá hạn thành công',
//       updatedTransactionCount: updatedTransactions.count,
//       updatedStepCount: updatedSteps.count,
//     };
//   }
// }
