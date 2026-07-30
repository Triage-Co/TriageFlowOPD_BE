import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IFlowRepository } from '../../shared/interfaces/i-flow.repository';
import { PrismaService } from '../../shared/config/prisma.service';
import { TemplateStepDto } from '../template/dto/create-template.dto';
import { ClinicalRoomType, StepTypeEnum } from '@prisma/client';
import type { IServiceOrderDetailRepository } from '../../shared/interfaces/i-service-order-detail.repository';
import type { IServiceOrderRepository } from '../../shared/interfaces/i-service-order.repository';
import type { IServiceRepository } from '../../shared/interfaces/i-service.repository';
// import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class FlowService {
  constructor(
    @Inject('IFlowRepository') private readonly flowRepository: IFlowRepository,
    private readonly prismaService: PrismaService,
    @Inject('IServiceOrderDetailRepository')
    private readonly serviceOrderDetailRepository: IServiceOrderDetailRepository,
    @Inject('IServiceOrderRepository')
    private readonly serviceOrderRepository: IServiceOrderRepository,
    @Inject('IServiceRepository')
    private readonly serviceRepository: IServiceRepository,
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

  // async addTemplateToFlow(flowId: string, templateId: string) {
  //   const existingFlow = await this.prismaService.flow.findUnique({
  //     where: { flow_id: flowId },
  //     include: {
  //       steps: {
  //         include: {
  //           room: true,
  //         },
  //       },
  //       booking: {
  //         include: {
  //           slot: {
  //             include: {
  //               shift: {
  //                 include: {
  //                   room: true,
  //                   staff: true,
  //                 },
  //               },
  //             },
  //           },
  //         },
  //       },
  //     },
  //   });
  //   if (!existingFlow) {
  //     throw new NotFoundException(
  //       'Không tìm thấy Flow hiện tại của bệnh nhân.',
  //     );
  //   }

  //   const specialtyId = existingFlow.booking.slot.shift.room.specialty_id;

  //   const template = await this.prismaService.flow_Template.findUnique({
  //     where: { template_id: templateId },
  //   });

  //   if (!template) {
  //     throw new NotFoundException(
  //       'Không tìm thấy Flow Template được chỉ định.',
  //     );
  //   }

  //   const templateSteps = template.steps as unknown as TemplateStepDto[];
  //   const idMapping = new Map<string, string>();
  //   const createdStepIds: string[] = [];

  //   return this.prismaService.$transaction(
  //     async (tx) => {
  //       const extractPaidServiceCodes = (steps: TemplateStepDto[]) => {

  //         let codes: string[] = [];

  //         for (const step of steps) {
  //           if (step.requires_payment && step.service_code) {
  //             codes.push(step.service_code);
  //           }
  //           if (step.sub_steps && step.sub_steps.length > 0) {
  //             codes.push(...extractPaidServiceCodes(step.sub_steps));
  //           }
  //         }
  //         return codes;
  //       };

  //       const paidServiceCodes = extractPaidServiceCodes(templateSteps);

  //       let createdInvoice: any = null;
  //       let servicesMap = new Map<string, any>();
  //       let serviceOrder: any = null;
  //       if (paidServiceCodes.length > 0) {
  //         const services = await tx.service.findMany({
  //           where: { service_code: { in: paidServiceCodes } },
  //         });
  //         for (const svc of services) {
  //           if (svc.service_code) {
  //             servicesMap.set(svc.service_code, svc);
  //           }
  //         }

  //         serviceOrder = await tx.service_Order.create({
  //           data: {
  //             booking_id: existingFlow.booking_id,
  //             staff_id: "",
  //             status: 'PENDING',
  //           },
  //         });

  //         createdInvoice = await tx.invoice.create({
  //           data: {
  //             service_order_id: serviceOrder.service_order_id,
  //             status: 'PENDING',
  //             total_amount: 0,
  //           }
  //         });
  //       }

  //       const saveStepsRecursively = async (
  //         steps: TemplateStepDto[],
  //         parentStepId: string | null = null,
  //       ) => {
  //         for (const step of steps) {

  //           const neededSpecialFilter = [
  //             "CLINICAL_ROOM"
  //           ].includes(step.room_type);

  //           const availableRooms = await tx.room.findMany({
  //             where: {
  //               room_type: step.room_type,
  //               ...(neededSpecialFilter && { specialty_id: specialtyId }),
  //               shifts: {
  //                 some: {
  //                   slots: {
  //                     some: {
  //                       capacity: {
  //                         gt: 0,
  //                       },
  //                     },
  //                   },
  //                 },
  //               },
  //             },
  //             include: {
  //               shifts: {
  //                 where: {
  //                   slots: {
  //                     some: {
  //                       capacity: {
  //                         gt: 0,
  //                       },
  //                     },
  //                   },
  //                 },
  //                 include: {
  //                   slots: {
  //                     where: {
  //                       capacity: {
  //                         gt: 0,
  //                       },
  //                     },
  //                     orderBy: [{ capacity: 'desc' }, { start_time: 'asc' }],
  //                   },
  //                 },
  //               },
  //             },
  //           });

  //           if (availableRooms.length === 0) {
  //             throw new Error(
  //               `Không có phòng nào trống cho dịch vụ: ${step.room_type}`,
  //             );
  //           }

  //           const currentIndex =
  //             this.roundRobinTracker.get(step.room_type) || 0;

  //           const selectedRoom =
  //             availableRooms[currentIndex % availableRooms.length];

  //           this.roundRobinTracker.set(step.room_type, currentIndex + 1);

  //           let currentServiceOrderId = null;
  //           if (step.requires_payment && step.service_code && serviceOrder) {
  //             currentServiceOrderId = serviceOrder.service_order_id;
  //             const svc = servicesMap.get(step.service_code);

  //             if (svc) {
  //               await tx.service_Order_Detail.create({
  //                 data: {
  //                   service_order_id: serviceOrder.service_order_id,
  //                   service_id: svc.service_id,
  //                   price_at_order: svc.price,
  //                   quantity: 1,
  //                   status: 'PENDING'
  //                 }
  //               });

  //               await tx.invoice_Detail.create({
  //                 data: {
  //                   invoice_id: createdInvoice.invoice_id,
  //                   item_name: svc.service_name || 'Dịch vụ y tế',
  //                   quantity: 1,
  //                   unit_price: svc.price,
  //                   sub_total: svc.price
  //                 }
  //               });
  //             } else {
  //               throw new Error(`Không tìm thấy dịch vụ với mã: ${step.service_code}`);
  //             }
  //           }

  //           const createdStep = await tx.step.create({
  //             data: {
  //               flow_id: flowId,
  //               step_status: 'PENDING',
  //               step_name: step.step_name || template.template_name,
  //               room_id: selectedRoom.room_id,
  //               staff_id: selectedRoom.shifts[0].staff_id,
  //               parent_step_id: parentStepId,
  //               service_code: step.service_code,
  //               service_order_id: currentServiceOrderId
  //             },
  //           });

  //           idMapping.set(step.template_step_id, createdStep.step_id);
  //           createdStepIds.push(createdStep.step_id);

  //           if (step.sub_steps && step.sub_steps.length > 0) {
  //             await saveStepsRecursively(step.sub_steps, createdStep.step_id);
  //           }
  //         }
  //       };
  //       await saveStepsRecursively(templateSteps);

  //       if (serviceOrder) {
  //         const invoiceDetails = await tx.invoice_Detail.findMany({
  //           where: { invoice: { service_order_id: serviceOrder.service_order_id } }
  //         });
  //         const totalAmount = invoiceDetails.reduce((sum, item) => sum + item.sub_total, 0);
  //         await tx.invoice.update({
  //           where: { service_order_id: serviceOrder.service_order_id },
  //           data: { total_amount: totalAmount }
  //         });
  //       }

  //       const saveDependenciesRecursively = async (
  //         steps: TemplateStepDto[],
  //       ) => {
  //         for (const step of steps) {
  //           if (step.depends_on && step.depends_on.length > 0) {
  //             const stepId = idMapping.get(step.template_step_id);
  //             for (const requiredStep of step.depends_on) {
  //               const dependsOnStepId = idMapping.get(requiredStep);

  //               if (stepId && dependsOnStepId) {
  //                 await tx.step_Dependency.create({
  //                   data: {
  //                     step_id: stepId,
  //                     depends_on_step_id: dependsOnStepId,
  //                   },
  //                 });
  //               }
  //             }
  //           }
  //           if (step.sub_steps && step.sub_steps.length > 0) {
  //             await saveDependenciesRecursively(step.sub_steps);
  //           }
  //         }
  //       };

  //       await saveDependenciesRecursively(templateSteps);

  //       // for (const stepId of createdStepIds) {
  //       //   const currentStep = await tx.step.findUnique({
  //       //     where: { step_id: stepId },
  //       //     select: { parent_step_id: true },
  //       //   });

  //       //   const dependencyCount = await tx.step_Dependency.count({
  //       //     where: { step_id: stepId },
  //       //   });

  //       //   let isReadyToProgress = false;

  //       //   if (dependencyCount == 0) {
  //       //     if (!currentStep?.parent_step_id) {
  //       //       isReadyToProgress = true;
  //       //     } else {
  //       //       const parentStep = await tx.step.findUnique({
  //       //         where: { step_id: currentStep.parent_step_id },
  //       //         select: { step_status: true },
  //       //       });

  //       //       if (parentStep?.step_status === 'IN_PROGRESS') {
  //       //         isReadyToProgress = true;
  //       //       }
  //       //     }
  //       //   }
  //       //   if (isReadyToProgress) {
  //       //     await tx.step.update({
  //       //       where: { step_id: stepId },
  //       //       data: { step_status: 'IN_PROGRESS' },
  //       //     });
  //       //   }
  //       // }

  //       return {
  //         code: 200,
  //         status: 'success',
  //         message: 'Tạo template thành công',
  //         flow_id: flowId,
  //       };
  //     },
  //     {
  //       maxWait: 10000,
  //       timeout: 30000,
  //     },
  //   );
  // }

  async addTemplateToFlow(flowId: string, templateSteps: TemplateStepDto[]) {
    const existingFlow = await this.prismaService.flow.findUnique({
      where: { flow_id: flowId },
      include: {
        steps: { include: { room: true } },
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

    return this.prismaService.$transaction(
      async (tx) => {
        const extractPaidSteps = (steps: TemplateStepDto[]) => {
          const paidSteps: TemplateStepDto[] = [];
          for (const step of steps) {
            if (step.requires_payment && step.service_code) {
              paidSteps.push(step);
            }
            if (step.sub_steps && step.sub_steps.length > 0) {
              paidSteps.push(...extractPaidSteps(step.sub_steps));
            }
          }
          return paidSteps;
        };

        const stepsNeedingPayment = extractPaidSteps(templateSteps);

        if (stepsNeedingPayment.length > 0) {
          const serviceCodes = stepsNeedingPayment.map((s) => s.service_code);

          const services = await tx.service.findMany({
            where: { service_code: { in: serviceCodes } },
          });
          const servicesMap = new Map(services.map((s) => [s.service_code, s]));

          for (const step of stepsNeedingPayment) {
            const svc = servicesMap.get(step.service_code);
            if (!svc)
              throw new Error(
                `Không tìm thấy dịch vụ với mã: ${step.service_code}`,
              );

            const createdServiceOrder = await tx.service_Order.create({
              data: {
                booking_id: existingFlow.booking_id,
                name: 'Thanh toán: ' + (step.step_name || svc.service_name),
                status: 'PENDING',
              },
            });

            const createdInvoice = await tx.invoice.create({
              data: {
                service_order_id: createdServiceOrder.service_order_id,
                status: 'PENDING',
                total_amount: svc.price,
              },
            });

            await tx.service_Order_Detail.create({
              data: {
                service_order_id: createdServiceOrder.service_order_id,
                service_id: svc.service_id,
                price_at_order: svc.price,
                quantity: 1,
                status: 'PENDING',
              },
            });

            await tx.invoice_Detail.create({
              data: {
                invoice_id: createdInvoice.invoice_id,
                item_name: svc.service_name || 'Dịch vụ y tế',
                quantity: 1,
                unit_price: svc.price,
                sub_total: svc.price,
              },
            });

            // Pass the service order ID to the step so it can be saved later
            (step as any).service_order_id = createdServiceOrder.service_order_id;

            // Tạo thêm 1 step THANH TOÁN (PAYMENT) cho dịch vụ này
            const stepKey = step.template_id || step.template_step_id;
            const paymentStepId = `payment_${stepKey}_${Date.now()}`;
            const paymentStepDto: TemplateStepDto = {
              template_id: paymentStepId,
              template_step_id: paymentStepId,
              service_code: '', // Không cần thiết
              step_name: `Thanh toán: ${step.step_name}`,
              step_type: 'PAYMENT' as any,
              room_type: 'CASHIER' as any,
              requires_payment: false,
              depends_on: step.depends_on ? [...step.depends_on] : [],
              sub_steps: [],
            };
            (paymentStepDto as any).service_order_id = createdServiceOrder.service_order_id;

            // Yêu cầu bước có phí phải phụ thuộc vào bước THANH TOÁN này
            if (!step.depends_on) {
              step.depends_on = [];
            }
            step.depends_on.push(paymentStepId);

            templateSteps.unshift(paymentStepDto); // Đẩy vào đầu danh sách
          }
        }

        const idMapping = new Map<string, string>();

        const saveStepsRecursively = async (
          steps: TemplateStepDto[],
          parentStepId: string | null = null,
        ) => {
          for (const step of steps) {
            const neededSpecialFilter = ['CLINICAL_ROOM'].includes(
              step.room_type,
            );

            const availableRooms = await tx.room.findMany({
              where: {
                room_type: step.room_type,
                ...(neededSpecialFilter && { specialty_id: specialtyId }),
                shifts: {
                  some: {
                    slots: { some: { capacity: { gt: 0 } } },
                  },
                },
              },
              include: {
                shifts: {
                  where: {
                    slots: { some: { capacity: { gt: 0 } } },
                  },
                  include: {
                    slots: {
                      where: { capacity: { gt: 0 } },
                      orderBy: [{ capacity: 'desc' }, { start_time: 'asc' }],
                    },
                  },
                },
              },
            });

            if (availableRooms.length === 0) {
              if (step.room_type === 'CASHIER') {
                // Cho phép CASHIER không cần gán phòng/nhân viên cụ thể ngay lập tức
                availableRooms.push({ room_id: null, shifts: [{ staff_id: null }] } as any);
              } else {
                throw new Error(
                  `Không có phòng nào trống cho dịch vụ: ${step.room_type}`,
                );
              }
            }

            const currentIndex =
              this.roundRobinTracker.get(step.room_type) || 0;
            const selectedRoom =
              availableRooms[currentIndex % availableRooms.length];
            if (availableRooms.length > 1 || availableRooms[0]?.room_id !== null) {
              this.roundRobinTracker.set(step.room_type, currentIndex + 1);
            }

            let currentServiceOrderId = null;
            if ((step as any).service_order_id) {
              currentServiceOrderId = (step as any).service_order_id;
            }

            const createdStep = await tx.step.create({
              data: {
                flow_id: flowId,
                step_status: 'PENDING',
                step_name: step.step_name,
                room_id: selectedRoom.room_id,
                staff_id: selectedRoom.shifts[0].staff_id,
                parent_step_id: parentStepId,
                service_code: step.service_code,
                service_order_id: currentServiceOrderId,
                step_type: step.step_type as StepTypeEnum,
              },
            });

            const stepKey = step.template_id || step.template_step_id;
            if (stepKey) {
              idMapping.set(stepKey, createdStep.step_id);
            }

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
              const stepKey = step.template_id || step.template_step_id;
              const stepId = stepKey ? idMapping.get(stepKey) : undefined;

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

        for (const stepId of Array.from(idMapping.values())) {
          const currentStep = await tx.step.findUnique({
            where: { step_id: stepId },
            select: { parent_step_id: true },
          });

          const dependencyCount = await tx.step_Dependency.count({
            where: { step_id: stepId },
          });

          let isReadyToProgress = false;

          if (dependencyCount == 0) {
            if (!currentStep?.parent_step_id) {
              isReadyToProgress = true;
            } else {
              const parentStep = await tx.step.findUnique({
                where: { step_id: currentStep.parent_step_id },
                select: { step_status: true },
              });

              if (
                parentStep?.step_status === 'IN_PROGRESS' ||
                parentStep?.step_status === 'COMPLETED'
              ) {
                isReadyToProgress = true;
              }
            }
          }
          if (isReadyToProgress) {
            await tx.step.update({
              where: { step_id: stepId },
              data: { step_status: 'IN_PROGRESS' },
            });
          }
        }

        return {
          code: 200,
          status: 'success',
          message: 'Tạo Service Order và gắn Step vào luồng thành công',
          flow_id: flowId,
        };
      },
      {
        maxWait: 10000,
        timeout: 30000,
      },
    );
  }
}
