import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateServiceOrderReqDto,
  QueryServiceOrderReqDto,
  UpdateServiceOrderReqDto,
} from './dto/req-service_order.dto';
import { ServiceOrderErrors } from '../../shared/exceptions/service_order.exceptions';
import type { IServiceOrderRepository } from '../../shared/interfaces/i-service-order.repository';
import {
  ClinicalRoomType,
  ServiceOrderStatusEnum,
  Step,
  StepTypeEnum,
  StepStatusEnum,
  TransTypeEnum,
  FlowStatusEnum,
  ServiceOrderDetailStatusEnum,
  TransStatusEnum,
  InvoiceStatusEnum,
  PrescriptionStatusEnum,
  PaymentStatusEnum,
} from '@prisma/client';
import type { IBookingRepository } from '../../shared/interfaces/i-booking.repository';
import type { IStepRepository } from '../../shared/interfaces/i-step.repository';
import type { ISpecialtyRepository } from '../../shared/interfaces/i-specialty.repository';
import type { IRoomRepository } from '../../shared/interfaces/i-room.repository';
import type { IServiceOrderDetailRepository } from '../../shared/interfaces/i-service-order-detail.repository';
import type { IServiceRepository } from '../../shared/interfaces/i-service.repository';
import type { IInvoiceRepository } from '../../shared/interfaces/i-invoice.repository';
import type { IInvoiceDetailRepository } from '../../shared/interfaces/i-invoice-detail.repository';
import { PrismaService } from '../../shared/config/prisma.service';
import { QueueEtaService } from '../queue/queue-eta.service';
import { REBALANCEABLE_STEP_TYPES } from '../queue/queue.constants';
import { TransactionService } from '../transaction/transaction.service';

const ROOM_TYPE_TO_STEP_TYPE: Partial<Record<ClinicalRoomType, StepTypeEnum>> = {
  [ClinicalRoomType.LABORATORY]: StepTypeEnum.LAB_TEST,
  [ClinicalRoomType.IMAGING_ROOM]: StepTypeEnum.IMAGING,
  [ClinicalRoomType.PROCEDURE_ROOM]: StepTypeEnum.PROCEDURE,
  [ClinicalRoomType.FUNCTIONAL_EXPLORATION]: StepTypeEnum.FUNCTIONAL_EXPLORATION,
};

@Injectable()
export class ServiceOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueEtaService: QueueEtaService,
    private readonly transactionService: TransactionService,

    @Inject('IServiceOrderRepository')
    private readonly serviceOrderRepository: IServiceOrderRepository,
    @Inject('IServiceOrderDetailRepository')
    private readonly serviceOrderDetailRepository: IServiceOrderDetailRepository,
    @Inject('IServiceRepository')
    private readonly serviceRepository: IServiceRepository,
    @Inject('IInvoiceRepository')
    private readonly invoiceRepository: IInvoiceRepository,
    @Inject('IInvoiceDetailRepository')
    private readonly invoiceDetailRepository: IInvoiceDetailRepository,
    @Inject('IBookingRepository')
    private readonly bookingRepository: IBookingRepository,
    @Inject('IStepRepository')
    private readonly stepRepository: IStepRepository,
    @Inject('ISpecialtyRepository')
    private readonly specialtyRepository: ISpecialtyRepository,
    @Inject('IRoomRepository')
    private readonly roomRepository: IRoomRepository,
  ) { }

  async create(createServiceOrderReqDto: CreateServiceOrderReqDto, assign_by_staff_id?: string) {
    const {
      service_code,
      booking_id,
      room_id: assigned_room_id,
    } = createServiceOrderReqDto;

    const is_payment = service_code && service_code.length > 0;

    try {
      const booking = await this.bookingRepository.findOne(booking_id);
      if (!booking) {
        throw new NotFoundException({
          message: 'Không tìm thấy booking',
          detail: `Không tìm thấy booking với id: ${booking_id}`,
        });
      }
      const flow = booking.flow;
      if (!flow) {
        throw new NotFoundException({
          message: 'Không tìm thấy flow',
          detail: `Không tìm thấy flow với id: ${booking.flow?.flow_id}`,
        });
      }

      if (!service_code || service_code.length === 0) {
        throw new BadRequestException('Mảng service_code không được để trống');
      }

      const services = await this.prisma.service.findMany({
        where: { service_code: { in: service_code } },
      });

      if (services.length !== service_code.length) {
        throw new NotFoundException({
          message: 'Không tìm thấy một số service',
          detail: `Vui lòng kiểm tra lại mã service`,
        });
      }

      const existingDuplicates = await this.prisma.service_Order_Detail.findMany({
        where: {
          order: {
            booking_id: booking_id,
            status: { not: ServiceOrderStatusEnum.CANCELLED },
          },
          service_id: { in: services.map(s => s.service_id) },
          status: { not: ServiceOrderDetailStatusEnum.CANCELLED },
        },
      });

      if (existingDuplicates.length > 0) {
        throw new BadRequestException({
          message: 'Dịch vụ này đã được chỉ định',
          detail: `Một số dịch vụ đã tồn tại trong luồng này. Không thể chỉ định trùng lặp.`,
        });
      }

      const steps = flow.steps;

      const latestStep = await this.prisma.step.findFirst({
        where: { flow_id: flow.flow_id },
        orderBy: { created_at: 'desc' },
      });
      const lastStep = latestStep || steps[steps.length - 1];

      const groupedServices = new Map<StepTypeEnum, any[]>();
      for (const service of services) {
        const targetStepType =
          service.room_type === ClinicalRoomType.LABORATORY ? StepTypeEnum.LAB_TEST
            : service.room_type === ClinicalRoomType.IMAGING_ROOM ? StepTypeEnum.IMAGING
              : service.room_type === ClinicalRoomType.PROCEDURE_ROOM ? StepTypeEnum.PROCEDURE
                : service.room_type === ClinicalRoomType.FUNCTIONAL_EXPLORATION ? StepTypeEnum.FUNCTIONAL_EXPLORATION
                  : StepTypeEnum.CLINICAL;

        if (!groupedServices.has(targetStepType)) {
          groupedServices.set(targetStepType, []);
        }
        groupedServices.get(targetStepType)!.push(service);
      }

      const createdServiceOrders: any[] = [];

      for (const [targetStepType, groupServices] of groupedServices.entries()) {
        const serviceRoomMap = new Map();
        let stepStaffId: string | undefined | null = null;

        for (const service of groupServices) {
          let room: any = null;
          if (assigned_room_id) {
            room = await this.roomRepository.findById(assigned_room_id);
            if (!room) {
              throw new NotFoundException({
                message: 'Không tìm thấy phòng',
                detail: `Không tìm thấy phòng với id: ${assigned_room_id}`,
              });
            }
            stepStaffId = null;
          } else if (service.room_type) {
            const mappedStepType = ROOM_TYPE_TO_STEP_TYPE[service.room_type];
            const isRebalanceable = !!mappedStepType && REBALANCEABLE_STEP_TYPES.includes(mappedStepType);
            if (isRebalanceable) {
              const roomServices = await this.prisma.room_Service.findMany({
                where: { service_id: service.service_id, is_active: true },
                include: { room: true },
              });
              if (roomServices.length >= 1) {
                let minEtaRoom: any = null;
                let minEtaSec = Infinity;
                for (const rs of roomServices) {
                  const etaResult = await this.queueEtaService.computeEtaForRoom(rs.room_id);
                  if (etaResult.totalWaitingSec < minEtaSec) {
                    minEtaSec = etaResult.totalWaitingSec;
                    minEtaRoom = rs.room;
                  }
                }
                if (minEtaRoom) room = minEtaRoom;
              }
            }
            if (!room) room = await this.roomRepository.findBestRoomByRoomType(service.room_type);
            if (!room) {
              throw new NotFoundException({
                message: 'Không tìm thấy phòng phù hợp cho loại dịch vụ này',
                detail: `Không tìm thấy room với room_type: ${service.room_type}`,
              });
            }
          } else {
            throw new NotFoundException({
              message: 'Không tìm thấy phòng với chuyên khoa cần khám',
              detail: `Service ${service.service_name} không có room_type`,
            });
          }

          if (room && !assigned_room_id && stepStaffId === null) {
            const staff = room.shifts && room.shifts.length > 0 ? room.shifts[0].staff : null;
            stepStaffId = staff?.staff_id;
          }
          serviceRoomMap.set(service.service_id, room);
        }

        let existingOrder = await this.prisma.service_Order.findFirst({
          where: {
            booking_id: booking_id,
            type: targetStepType,
            status: ServiceOrderStatusEnum.PENDING,
            payment_status: PaymentStatusEnum.PENDING,
          },
          include: { invoices: true, steps: { where: { step_type: StepTypeEnum.PAYMENT } } }
        });

        let serviceOrder: any = null;
        let paymentStep: any = null;
        let isFree = false;

        const newServiceNames = groupServices.map(s => s.service_name).join(', ');
        const additionalPrice = groupServices.reduce((sum, s) => sum + (s.price || 0), 0);

        if (existingOrder) {
          const updatedName = existingOrder.name ? `${existingOrder.name}, ${newServiceNames}` : newServiceNames;
          
          serviceOrder = await this.serviceOrderRepository.update(
            existingOrder.service_order_id,
            { name: updatedName }
          );

          if (is_payment) {
            const invoice = existingOrder.invoices[0];
            const newTotalAmount = (invoice?.total_amount || 0) + additionalPrice;
            isFree = newTotalAmount === 0;

            if (invoice) {
              await this.invoiceRepository.update(invoice.invoice_id, {
                total_amount: newTotalAmount,
                status: isFree ? InvoiceStatusEnum.PAID : InvoiceStatusEnum.PENDING,
              });

              for (const service of groupServices) {
                await this.invoiceDetailRepository.create({
                  invoice_id: invoice.invoice_id,
                  item_name: service.service_name ?? 'Dịch vụ',
                  quantity: 1,
                  unit_price: service.price || 0,
                  sub_total: service.price || 0,
                });
              }
            }

            if (existingOrder.steps && existingOrder.steps.length > 0) {
              paymentStep = existingOrder.steps[0];
              const existingServiceCount = (existingOrder.name?.split(',').length || 0);
              const newServiceCount = existingServiceCount + groupServices.length;
              await this.stepRepository.update(paymentStep.step_id, {
                step_name: `Thanh toán ${updatedName}`,
                step_status: isFree ? StepStatusEnum.COMPLETED : StepStatusEnum.PENDING,
              });
            }

            if (isFree) {
              await this.serviceOrderRepository.update(
                serviceOrder.service_order_id,
                { payment_status: PaymentStatusEnum.SUCCESSED, qr_code: null },
              );
            } else {
              const paymentLink = await this.transactionService.create({
                cancelUrl: 'https://triageflow.me/api-docs',
                returnUrl: 'https://triageflow.me/api-docs',
                transType: TransTypeEnum.ORDER_PAYMENT,
                amount: newTotalAmount,
                clientId: booking.patient_id,
                service_order_id: serviceOrder.service_order_id,
              });

              if (!paymentLink || !('data' in paymentLink)) {
                throw new BadRequestException((paymentLink?.detail as any)?.error?.desc || 'Lỗi tạo giao dịch thanh toán');
              }

              await this.serviceOrderRepository.update(
                serviceOrder.service_order_id,
                { qr_code: paymentLink.data.qrCode },
              );
            }
          }
        } else {
          serviceOrder = await this.serviceOrderRepository.create({
            booking_id,
            name: newServiceNames,
            type: targetStepType,
            assign_by_staff_id,
            status: ServiceOrderStatusEnum.PENDING,
          });

          if (is_payment) {
            isFree = additionalPrice === 0;

            paymentStep = await this.stepRepository.createParentStep({
              flow_id: flow.flow_id,
              step_type: StepTypeEnum.PAYMENT,
              service_code: groupServices[0].service_code,
              step_name: `Thanh toán ${newServiceNames}`,
              service_order_id: serviceOrder.service_order_id,
              step_status: isFree ? StepStatusEnum.COMPLETED : StepStatusEnum.PENDING,
            });

            await this.stepRepository.createDependency(
              paymentStep.step_id,
              lastStep.step_id,
            );

            const invoice = await this.invoiceRepository.create({
              service_order_id: serviceOrder.service_order_id,
              total_amount: additionalPrice,
              status: isFree ? InvoiceStatusEnum.PAID : InvoiceStatusEnum.PENDING,
            });

            for (const service of groupServices) {
              await this.invoiceDetailRepository.create({
                invoice_id: invoice.invoice_id,
                item_name: service.service_name ?? 'Dịch vụ',
                quantity: 1,
                unit_price: service.price || 0,
                sub_total: service.price || 0,
              });
            }

            if (isFree) {
              await this.serviceOrderRepository.update(
                serviceOrder.service_order_id,
                { payment_status: PaymentStatusEnum.SUCCESSED },
              );
            } else {
              const paymentLink = await this.transactionService.create({
                cancelUrl: 'https://triageflow.me/api-docs',
                returnUrl: 'https://triageflow.me/api-docs',
                transType: TransTypeEnum.ORDER_PAYMENT,
                amount: additionalPrice,
                clientId: booking.patient_id,
                service_order_id: serviceOrder.service_order_id,
              });

              if (!paymentLink || !('data' in paymentLink)) {
                throw new BadRequestException((paymentLink?.detail as any)?.error?.desc || 'Lỗi tạo giao dịch thanh toán');
              }

              await this.serviceOrderRepository.update(
                serviceOrder.service_order_id,
                { qr_code: paymentLink.data.qrCode },
              );
            }
          }
        }

        const stepInputs = groupServices.map(service => {
          const room = serviceRoomMap.get(service.service_id);
          return {
            flow_id: flow.flow_id,
            step_type: targetStepType,
            step_name: `${service.service_name}`,
            service_code: service.service_code,
            room_id: room.room_id,
            staff_id: stepStaffId,
            service_order_id: serviceOrder.service_order_id,
            step_status: StepStatusEnum.PENDING,
          };
        });

        const clinicalSteps = await this.stepRepository.createManyParentStep(stepInputs);

        for (const step of clinicalSteps) {
          await this.stepRepository.createDependency(
            step.step_id,
            paymentStep?.step_id ?? lastStep.step_id,
          );
        }

        for (const service of groupServices) {
          await this.serviceOrderDetailRepository.create({
            service_order_id: serviceOrder.service_order_id,
            quantity: 1,
            price_at_order: service.price,
            service_id: service.service_id,
            name: service.service_name,
          });
        }
        
        createdServiceOrders.push(serviceOrder);
      }

      return {
        code: 201,
        status: 'success',
        message: 'Tạo Service Order thành công',
        data: createdServiceOrders,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Lỗi không xác định';

      throw ServiceOrderErrors.ActionFailed('Tạo Service Order', errorMessage);
    }
  }

  async findAll(queryReqDto: QueryServiceOrderReqDto) {
    const { page, limit } = queryReqDto;

    try {
      const data = await this.serviceOrderRepository.findAll(page, limit);

      return {
        code: 200,
        status: 'success',
        message: 'Lấy danh sách Service Order thành công',
        data,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Lỗi không xác định';

      throw ServiceOrderErrors.ActionFailed(
        'Lấy danh sách Service Order',
        errorMessage,
      );
    }
  }

  async findOne(id: string) {
    const data = await this.serviceOrderRepository.findById(id);

    if (!data) {
      throw ServiceOrderErrors.ServiceOrderNotFoundById(id);
    }

    return {
      code: 200,
      status: 'success',
      message: 'Lấy thông tin Service Order thành công',
      data,
    };
  }

  async findPendingByPatientId(patientId: string) {
    try {
      const data =
        await this.serviceOrderRepository.findPendingByPatientId(patientId);

      const enrichedData = data.map((order: any) => {
        const totalPrice = order.serviceOrderDetails.reduce(
          (sum: number, detail: any) => {
            return sum + (detail.price_at_order || 0) * (detail.quantity || 1);
          },
          0,
        );
        return {
          ...order,
          total_price: totalPrice,
        };
      });

      return {
        code: 200,
        status: 'success',
        message: 'Lấy danh sách Service Order chờ thanh toán thành công',
        data: enrichedData,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Lỗi không xác định';

      throw ServiceOrderErrors.ActionFailed(
        'Lấy danh sách Service Order chờ thanh toán',
        errorMessage,
      );
    }
  }

  async findOrderServiceByBookingId(bookingId: string) {
    try {
      const data =
        await this.serviceOrderRepository.findOrderServiceByBookingId(
          bookingId,
        );

      return {
        code: 200,
        status: 'success',
        message: 'Lấy danh sách Service Order theo booking thành công',
        data,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Lỗi không xác định';

      throw ServiceOrderErrors.ActionFailed(
        'Lấy danh sách Service Order theo booking',
        errorMessage,
      );
    }
  }

  async update(id: string, updateServiceOrderReqDto: UpdateServiceOrderReqDto) {
    const existing = await this.serviceOrderRepository.findById(id);

    if (!existing) {
      throw ServiceOrderErrors.ServiceOrderNotFoundById(id);
    }

    if (existing.booking_id) {
      const booking = await this.prisma.booking.findUnique({
        where: { booking_id: existing.booking_id },
        include: { flow: true },
      });
      const flowStatus = booking?.flow?.status;
      if (
        flowStatus &&
        flowStatus !== FlowStatusEnum.IN_PROGRESS &&
        flowStatus !== FlowStatusEnum.PENDING
      ) {
        throw new BadRequestException(
          'Không thể cập nhật Service Order vì flow hiện tại không ở trạng thái IN_PROGRESS hoặc PENDING',
        );
      }
    }

    try {
      const {
        room_id,
        service_code,
        booking_id,
        ...updateData
      } = updateServiceOrderReqDto;

      const invoice: any =
        await this.invoiceRepository.findByServiceOrderId(id);
      const clinicalStep =
        await this.stepRepository.findClinicalStepByServiceOrderId(id);
      let paymentStep =
        await this.stepRepository.findPaymentStepByServiceOrderId(id);
      const orderDetail =
        await this.serviceOrderDetailRepository.findByServiceOrderId(id);

      let newService: any = null;
      let newPrice: number | undefined = undefined;
      let newServiceName: string | undefined = undefined;

      let service_code_single: string | undefined = undefined;
      if (service_code && service_code.length > 0) {
        service_code_single = service_code[0];
      }

      if (service_code_single) {
        newService = await this.serviceRepository.findByCode(service_code_single);
        if (!newService) {
          throw new Error(`Không tìm thấy service với code: ${service_code_single}`);
        }
        newPrice = newService.price;
        newServiceName = newService.service_name;
      }

      if (invoice && invoice.status === 'PAID') {
        if (
          service_code_single !== undefined &&
          newService?.service_id !== orderDetail?.service_id
        ) {
          throw new Error(
            'Không thể thay đổi dịch vụ vì hóa đơn đã được thanh toán.',
          );
        }
      }

      if (service_code_single) {
        if (orderDetail) {
          await this.serviceOrderDetailRepository.update(
            orderDetail.service_order_detail_id,
            {
              service_id: newService.service_id,
              price_at_order: newPrice,
              name: newServiceName,
            },
          );
        }

        if (!invoice) {
          const newInvoice = await this.invoiceRepository.create({
            service_order_id: id,
            total_amount: newPrice,
            status: 'PENDING',
          });
          await this.invoiceDetailRepository.create({
            invoice_id: newInvoice.invoice_id,
            item_name: newServiceName ?? 'Dịch vụ',
            quantity: 1,
            unit_price: newPrice,
            sub_total: newPrice,
          });
        } else {
          await this.invoiceRepository.update(invoice.invoice_id, {
            total_amount: newPrice,
          });
          if (invoice.invoice_details && invoice.invoice_details.length > 0) {
            const detailId = invoice.invoice_details[0].invoice_detail_id;
            await this.invoiceDetailRepository.update(detailId, {
              item_name: newServiceName ?? 'Dịch vụ',
              unit_price: newPrice,
              sub_total: newPrice,
            });
          }
        }

        if (clinicalStep) {
          await this.stepRepository.update(clinicalStep.step_id, {
            service_code: service_code_single,
            step_name: newServiceName,
          });
        }

        if (!paymentStep) {
          let flowId = clinicalStep?.flow_id;
          if (!flowId) {
            const bookingId = existing.booking_id ?? booking_id;
            if (!bookingId) {
              throw new Error(
                'Không tìm thấy booking_id để xác định flow khi tạo payment step.',
              );
            }
            const booking = await this.bookingRepository.findOne(bookingId);
            flowId = booking?.flow?.flow_id;
            if (!flowId) {
              throw new Error(
                'Không tìm thấy flow liên kết với booking để tạo payment step.',
              );
            }
          }

          paymentStep = await this.stepRepository.createParentStep({
            flow_id: flowId,
            step_type: 'PAYMENT',
            service_code: newService.service_code,
            step_name: `Thanh toán ${newService.service_name}`,
            service_order_id: id,
          });

          if (clinicalStep) {
            await this.stepRepository.createDependency(
              clinicalStep.step_id,
              paymentStep.step_id,
            );
          }
        } else {
          await this.stepRepository.update(paymentStep.step_id, {
            service_code: service_code_single,
            step_name: `Thanh toán ${newServiceName}`,
          });
        }
      }



      if (room_id !== undefined) {
        if (room_id) {
          if (clinicalStep) {
            await this.stepRepository.update(clinicalStep.step_id, {
              room_id: room_id,
            });
          }
        }
      }

      const data = await this.serviceOrderRepository.update(id, updateData);

      return {
        code: 200,
        status: 'success',
        message: 'Cập nhật Service Order thành công',
        data,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Lỗi không xác định';

      throw ServiceOrderErrors.ActionFailed(
        'Cập nhật Service Order',
        errorMessage,
      );
    }
  }

  async remove(id: string) {
    const existing = await this.serviceOrderRepository.findById(id);

    if (!existing) {
      throw ServiceOrderErrors.ServiceOrderNotFoundById(id);
    }

    if (existing.payment_status === 'SUCCESSED') {
      throw ServiceOrderErrors.ActionFailed(
        'Hủy Service Order',
        'Không thể hủy Service Order đã thanh toán thành công'
      );
    }

    try {
      await this.serviceOrderRepository.delete(id);

      await this.prisma.step.updateMany({
        where: { service_order_id: id },
        data: { step_status: StepStatusEnum.CANCELLED },
      });

      await this.prisma.service_Order_Detail.updateMany({
        where: {
          service_order_id: id
        },
        data: {
          status: ServiceOrderDetailStatusEnum.CANCELLED
        }
      });

      await this.prisma.invoice.updateMany({
        where: { service_order_id: id, status: InvoiceStatusEnum.PENDING },
        data: { status: InvoiceStatusEnum.CANCELLED },
      });

      await this.prisma.transaction.updateMany({
        where: {
          service_order_id: id,
          status: TransStatusEnum.PENDING
        },
        data: { status: TransStatusEnum.CANCELLED },
      });

      await this.prisma.prescription.updateMany({
        where: { service_order_id: id, status: PrescriptionStatusEnum.PENDING },
        data: { status: PrescriptionStatusEnum.CANCELLED },
      });

      const cancelledSteps = await this.prisma.step.findMany({
        where: { service_order_id: id },
        select: { step_id: true }
      });
      const stepIds = cancelledSteps.map(s => s.step_id);

      if (stepIds.length > 0) {
        await this.prisma.queue.updateMany({
          where: {
            step_id: { in: stepIds },
            status: StepStatusEnum.PENDING
          },
          data: { status: StepStatusEnum.CANCELLED },
        });
      }

      return {
        code: 200,
        status: 'success',
        message: 'Hủy Service Order và các dữ liệu liên quan thành công',
        data: null,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Lỗi không xác định';

      throw ServiceOrderErrors.ActionFailed('Hủy Service Order', errorMessage);
    }
  }
}
