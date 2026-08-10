import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
  ) { }

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
  async findIsActiveByPatientId(patient_id: string, date?: string) {
    const data = await this.flowRepository.findIsActiveByPatientId(
      patient_id,
      date,
    );

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

  /**
   * Tự động tạo Flow từ Service_Order của gói khám sau khi thanh toán xong.
   * Điều kiện: service_order phải có package_id và chưa có flow_id.
   */
  async createFlowFromServiceOrder(serviceOrderId: string) {
    const serviceOrder = await this.prismaService.service_Order.findUnique({
      where: { service_order_id: serviceOrderId },
      include: {
        package: {
          include: { template: true },
        },
        booking: true,
      },
    });

    if (!serviceOrder) {
      throw new NotFoundException(
        `Không tìm thấy service order: ${serviceOrderId}`,
      );
    }

    if (!serviceOrder.package_id || !serviceOrder.package) {
      return null;
    }

    if (serviceOrder.flow_id) {
      return {
        code: 200,
        status: 'success',
        message: 'Flow đã được tạo trước đó',
        flow_id: serviceOrder.flow_id,
      };
    }

    if (!serviceOrder.booking_id) {
      throw new BadRequestException(
        `Service order ${serviceOrderId} không có booking_id`,
      );
    }

    const existingFlow = await this.prismaService.flow.findUnique({
      where: { booking_id: serviceOrder.booking_id },
    });

    if (existingFlow) {
      await this.prismaService.service_Order.update({
        where: { service_order_id: serviceOrderId },
        data: { flow_id: existingFlow.flow_id },
      });
      return {
        code: 200,
        status: 'success',
        message:
          'Booking đã có Flow, đã liên kết service_order với flow hiện tại',
        flow_id: existingFlow.flow_id,
      };
    }

    const newFlow = await this.prismaService.flow.create({
      data: {
        booking_id: serviceOrder.booking_id,
        status: 'PENDING',
      },
    });

    await this.prismaService.service_Order.update({
      where: { service_order_id: serviceOrderId },
      data: { flow_id: newFlow.flow_id },
    });

    const templateSteps = serviceOrder.package.template
      .steps as unknown as TemplateStepDto[];

    // Truyền cờ isPrePaidPackage = true để không tạo thêm đơn thanh toán lẻ cho các bước
    return this.addTemplateToFlow(
      newFlow.flow_id,
      templateSteps,
      true,
      serviceOrderId,
    );
  }

  async addTemplateToFlowByTeamplateId(flowId: string, templateId: string) {
    const template = await this.prismaService.flow_Template.findUnique({
      where: { template_id: templateId },
    });

    if (!template) {
      throw new NotFoundException(
        'Không tìm thấy Flow Template được chỉ định.',
      );
    }

    const templateSteps = template.steps as unknown as TemplateStepDto[];
    return this.addTemplateToFlow(flowId, templateSteps);
  }

  async addTemplateToFlow(
    flowId: string,
    templateSteps: TemplateStepDto[],
    isPrePaidPackage: boolean = false,
    packageServiceOrderId: string | null = null,
  ) {
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
        // Nếu không phải gói khám trọn gói, mới tạo các đơn thanh toán riêng lẻ cho từng dịch vụ
        if (!isPrePaidPackage) {
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
            const servicesMap = new Map(
              services.map((s) => [s.service_code, s]),
            );

            for (const step of stepsNeedingPayment) {
              const svc = servicesMap.get(step.service_code);
              if (!svc)
                throw new Error(
                  `Không tìm thấy dịch vụ với mã: ${step.service_code}`,
                );

              const orderTargetStepType =
                svc.room_type === 'LABORATORY'
                  ? 'LAB_TEST'
                  : svc.room_type === 'IMAGING_ROOM'
                    ? 'IMAGING'
                    : svc.room_type === 'PROCEDURE_ROOM'
                      ? 'PROCEDURE'
                      : svc.room_type === 'FUNCTIONAL_EXPLORATION'
                        ? 'FUNCTIONAL_EXPLORATION'
                        : 'CLINICAL';

              const createdServiceOrder = await tx.service_Order.create({
                data: {
                  booking_id: existingFlow.booking_id,
                  name: svc.service_name || step.step_name || 'Dịch vụ y tế',
                  type: orderTargetStepType as any,
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

              (step as any).service_order_id =
                createdServiceOrder.service_order_id;

              const stepKey = step.template_id;
              const paymentStepId = `payment_${stepKey}_${Date.now()}`;
              const paymentStepDto: TemplateStepDto = {
                template_id: paymentStepId,
                service_code: '',
                step_name: `Thanh toán: ${step.step_name}`,
                step_type: 'PAYMENT',
                room_type: 'CASHIER',
                requires_payment: false,
                depends_on: step.depends_on ? [...step.depends_on] : [],
                sub_steps: [],
              };
              (paymentStepDto as any).service_order_id =
                createdServiceOrder.service_order_id;

              if (!step.depends_on) {
                step.depends_on = [];
              }
              step.depends_on.push(paymentStepId);

              templateSteps.unshift(paymentStepDto);
            }
          }
        } else {
          // Đối với gói khám trọn gói, gán service_order_id của gói cho toàn bộ steps
          // (nếu cần tracking xem step này thuộc đơn gói nào)
          const applyPackageOrderToSteps = (steps: TemplateStepDto[]) => {
            for (const step of steps) {
              (step as any).service_order_id = packageServiceOrderId;
              if (step.sub_steps && step.sub_steps.length > 0) {
                applyPackageOrderToSteps(step.sub_steps);
              }
            }
          };
          if (packageServiceOrderId) {
            applyPackageOrderToSteps(templateSteps);
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
                availableRooms.push({
                  room_id: null,
                  shifts: [{ staff_id: null }],
                } as any);
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
            if (
              availableRooms.length > 1 ||
              availableRooms[0]?.room_id !== null
            ) {
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

            const stepKey = step.template_id;
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
              const stepKey = step.template_id;
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

        let rootStepStarted = false;
        const rootStepIds: string[] = [];

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
              rootStepIds.push(stepId);
              if (!rootStepStarted) {
                isReadyToProgress = true;
                rootStepStarted = true;
              }
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

        // Chain the other root steps sequentially
        for (let i = 1; i < rootStepIds.length; i++) {
          await tx.step_Dependency.create({
            data: {
              step_id: rootStepIds[i],
              depends_on_step_id: rootStepIds[i - 1],
            },
          });
        }

        await tx.flow.update({
          where: { flow_id: flowId },
          data: { status: 'IN_PROGRESS' },
        });

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
