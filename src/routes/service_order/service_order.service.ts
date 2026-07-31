import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateServiceOrderReqDto,
  QueryServiceOrderReqDto,
  UpdateServiceOrderReqDto,
} from './dto/req-service_order.dto';
import { ServiceOrderErrors } from '../../shared/exceptions/service_order.exceptions';
import type { IServiceOrderRepository } from '../../shared/interfaces/i-service-order.repository';
import { ServiceOrderStatusEnum, Step, StepTypeEnum } from '@prisma/client';
import type { IBookingRepository } from '../../shared/interfaces/i-booking.repository';
import type { IStepRepository } from '../../shared/interfaces/i-step.repository';
import type { ISpecialtyRepository } from '../../shared/interfaces/i-specialty.repository';
import type { IRoomRepository } from '../../shared/interfaces/i-room.repository';
import type { IServiceOrderDetailRepository } from '../../shared/interfaces/i-service-order-detail.repository';
import type { IServiceRepository } from '../../shared/interfaces/i-service.repository';
import type { IInvoiceRepository } from '../../shared/interfaces/i-invoice.repository';
import type { IInvoiceDetailRepository } from '../../shared/interfaces/i-invoice-detail.repository';

@Injectable()
export class ServiceOrderService {
  constructor(
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

  async create(createServiceOrderReqDto: CreateServiceOrderReqDto) {
    const {
      service_code,
      specialty_id,
      is_payment,
      booking_id,
      name,
      assign_by_staff_id,
    } = createServiceOrderReqDto;

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
      const service = await this.serviceRepository.findByCode(service_code)
      if (!service) {
        throw new NotFoundException({
          message: 'Không tìm thấy service',
          detail: `Không tìm thấy service với code: ${service_code}`,
        });
      }
      const steps = flow.steps;
      const lastStep = steps[steps.length - 1];

      const serviceOrder = await this.serviceOrderRepository.create({
        booking_id,
        name,
        assign_by_staff_id,
        status: ServiceOrderStatusEnum.PENDING,
      });

      let paymentStep: Step | null = null;

      if (is_payment) {
        paymentStep = await this.stepRepository.createParentStep({
          flow_id: flow.flow_id,
          step_type: StepTypeEnum.PAYMENT,
          service_code: service_code,
          step_name: `Thanh toán ${service.service_name}`,
          service_order_id: serviceOrder.service_order_id,
        })

        await this.stepRepository.createDependency(
          paymentStep.step_id,
          lastStep.step_id
        )

        const invoice = await this.invoiceRepository.create({
          service_order_id: serviceOrder.service_order_id,
          total_amount: service.price,
          status: 'PENDING',
        });

        await this.invoiceDetailRepository.create({
          invoice_id: invoice.invoice_id,
          item_name: service.service_name ?? 'Dịch vụ',
          quantity: 1,
          unit_price: service.price,
          sub_total: service.price,
        });
      }

      let room: any = null;
      if (service.room_type) {
        room = await this.roomRepository.findBestRoomByRoomType(service.room_type);
        if (!room) {
          throw new NotFoundException({
            message: 'Không tìm thấy phòng phù hợp cho loại dịch vụ này',
            detail: `Không tìm thấy room với room_type: ${service.room_type}`,
          });
        }
      } else if (specialty_id) {
        const specialty = await this.specialtyRepository.findOne(specialty_id);
        if (!specialty) {
          throw new NotFoundException({
            message: 'Không tìm thấy specialty',
            detail: `Không tìm thấy specialty với id: ${specialty_id}`,
          });
        }

        room = await this.roomRepository.findBestRoomBySpecialtyId(specialty_id);
        if (!room) {
          throw new NotFoundException({
            message: 'Không tìm thấy phòng với chuyên khoa cần khám',
            detail: `Không tìm thấy room với chuyên khoa cần khám`,
          });
        }
      }

      if (room) {
        const staff = room.shifts && room.shifts.length > 0 ? room.shifts[0].staff : null;
        const step = await this.stepRepository.createParentStep({
          flow_id: flow.flow_id,
          step_type: StepTypeEnum.CLINICAL,
          step_name: `${service.service_name}`,
          service_code: service_code,
          room_id: room.room_id,
          staff_id: staff?.staff_id,
          service_order_id: serviceOrder.service_order_id,
        })


        await this.stepRepository.createDependency(
          step.step_id,
          paymentStep?.step_id ?? lastStep.step_id
        )
      }



      await this.serviceOrderDetailRepository.create({
        service_order_id: serviceOrder.service_order_id,
        quantity: 1,
        price_at_order: service.price,
        service_id: service.service_id,
        name: service.service_name
      })


      return {
        code: 201,
        status: 'success',
        message: 'Tạo Service Order thành công',
        data: serviceOrder,
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

      // Tính toán tổng tiền cho mỗi Service Order
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

  async update(id: string, updateServiceOrderReqDto: UpdateServiceOrderReqDto) {
    const existing = await this.serviceOrderRepository.findById(id);

    if (!existing) {
      throw ServiceOrderErrors.ServiceOrderNotFoundById(id);
    }

    try {
      const data = await this.serviceOrderRepository.update(
        id,
        updateServiceOrderReqDto,
      );

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

    try {
      await this.serviceOrderRepository.delete(id);

      return {
        code: 200,
        status: 'success',
        message: 'Xóa Service Order thành công',
        data: null,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Lỗi không xác định';

      throw ServiceOrderErrors.ActionFailed('Xóa Service Order', errorMessage);
    }
  }
}
