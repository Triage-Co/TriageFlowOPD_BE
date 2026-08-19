import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/config/prisma.service';
import { QueueGateway } from '../../../shared/gateways/queue.gateway';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import {
  ClinicalRoomType,
  PaymentStatusEnum,
  Prisma,
  PrescriptionStatusEnum,
  ServiceOrderStatusEnum,
  StepStatusEnum,
  StepTypeEnum,
  TransStatusEnum,
  TransTypeEnum,
  FlowStatusEnum,
} from '@prisma/client';
import { randomInt } from 'crypto';
import { format } from 'date-fns';
import { formatInTimeZone, toDate } from 'date-fns-tz';

const DOCTOR_SELECT = {
  staff_id: true,
  full_name: true,
  license_number: true,
  account: {
    select: {
      email: true,
      phone: true,
    },
  },
} as const;

const VN_TZ = 'Asia/Ho_Chi_Minh';
const MAX_PICKUP_SEQ = 999;
const PICKUP_NUMBER_RE = /^P(\d{1,3})$/;

type DbClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class PrescriptionService {
  private readonly logger = new Logger(PrescriptionService.name);

  constructor(
    private readonly prismaService: PrismaService,
    @Inject(forwardRef(() => QueueGateway))
    private readonly queueGateway: QueueGateway,
  ) {}

  private generatePrescriptionCode(): string {
    const dateStr = format(new Date(), 'yyyyMMdd');
    const randomNum = randomInt(1000, 9999);
    return `RX-${dateStr}-${randomNum}`;
  }

  private buildQrPayload(input: {
    code: string;
    visit_session_id?: string | null;
    service_order_id?: string | null;
    total_amount: number;
  }): string {
    return JSON.stringify({
      code: input.code,
      visit_session_id: input.visit_session_id || null,
      service_order_id: input.service_order_id || null,
      total_amount: input.total_amount,
    });
  }

  async create(
    createPrescriptionDto: CreatePrescriptionDto,
    defaultStaffId?: string,
  ) {
    const {
      visit_session_id,
      service_order_id,
      prescribed_by,
      diagnosis_note,
      details,
    } = createPrescriptionDto;

    let bookingId: string | undefined = undefined;
    let flowId: string | undefined = undefined;

    if (visit_session_id) {
      // 1. Kiểm tra xem phiên khám có tồn tại không
      const visitSession = await this.prismaService.visit_Session.findUnique({
        where: { visit_session_id },
        include: {
          patient: true,
          booking: {
            include: {
              flow: true,
            },
          },
        },
      });

      if (!visitSession) {
        throw new NotFoundException(
          `Không tìm thấy phiên khám bệnh với ID: ${visit_session_id}`,
        );
      }

      // 2. Kiểm tra xem phiên khám đã có đơn thuốc chưa
      const existingPrescription =
        await this.prismaService.prescription.findUnique({
          where: { visit_session_id },
        });

      if (existingPrescription) {
        throw new ConflictException(
          `Phiên khám '${visit_session_id}' đã có đơn thuốc được kê.`,
        );
      }

      bookingId = visitSession.booking_id ?? undefined;
      flowId = visitSession.booking?.flow?.flow_id ?? undefined;
    }

    if (!details || details.length === 0) {
      throw new BadRequestException(
        'Đơn thuốc phải bao gồm ít nhất một loại thuốc.',
      );
    }

    // 3. Lấy thông tin các thuốc từ DB để xác thực và lấy giá tiền chuẩn
    const medicineIds = details.map((d) => d.medicine_id);
    const medicines = await this.prismaService.medicine.findMany({
      where: {
        medicine_id: { in: medicineIds },
      },
    });

    const medicineMap = new Map(medicines.map((m) => [m.medicine_id, m]));

    for (const item of details) {
      const med = medicineMap.get(item.medicine_id);
      if (!med) {
        throw new NotFoundException(
          `Không tìm thấy loại thuốc với ID: ${item.medicine_id}`,
        );
      }
      if (!med.is_active) {
        throw new BadRequestException(
          `Thuốc '${med.medicine_name}' đã ngưng hoạt động.`,
        );
      }
    }

    // 4. Tính toán chi tiết & tổng số tiền đơn thuốc
    let totalAmount = 0;
    const preparedDetails = details.map((item) => {
      const med = medicineMap.get(item.medicine_id)!;
      const unitPrice = med.unit_price || 0;
      const subTotal = unitPrice * item.quantity;
      totalAmount += subTotal;

      return {
        medicine_id: item.medicine_id,
        quantity: item.quantity,
        dosage_instruction: item.dosage_instruction,
        unit_price: unitPrice,
        sub_total: subTotal,
        note: item.note,
      };
    });

    const staffId = prescribed_by || defaultStaffId;
    const prescriptionCode = this.generatePrescriptionCode();

    // 5. Lưu đơn thuốc, tự động sinh Service_Order (nếu chưa có) và Prescription_Detail trong transaction
    return this.prismaService.$transaction(async (tx) => {
      let targetServiceOrderId = service_order_id;

      if (!targetServiceOrderId) {
        const newServiceOrder = await tx.service_Order.create({
          data: {
            booking_id: bookingId,
            name: `Đơn thuốc - ${prescriptionCode}`,
            assign_by_staff_id: staffId,
            status: ServiceOrderStatusEnum.PENDING,
            payment_status: PaymentStatusEnum.PENDING,
            qr_code: prescriptionCode,
          },
        });
        targetServiceOrderId = newServiceOrder.service_order_id;
      }

      const qrCodePayload = this.buildQrPayload({
        code: prescriptionCode,
        visit_session_id,
        service_order_id: targetServiceOrderId,
        total_amount: totalAmount,
      });

      const prescription = await tx.prescription.create({
        data: {
          prescription_code: prescriptionCode,
          qr_code: qrCodePayload,
          service_order_id: targetServiceOrderId,
          visit_session_id: visit_session_id || null,
          booking_id: bookingId || null,
          flow_id: flowId || null,
          prescribed_by: staffId,
          diagnosis_note,
          total_amount: totalAmount,
          status: PrescriptionStatusEnum.PENDING,
          prescriptionDetails: {
            createMany: {
              data: preparedDetails,
            },
          },
        },
        include: {
          serviceOrder: true,
          doctor: {
            select: DOCTOR_SELECT,
          },
          prescriptionDetails: {
            include: {
              medicine: true,
            },
          },
        },
      });

      // Advance flow: gắn bước DISPENSING (nhà thuốc) vào flow hiện tại
      if (flowId) {
        const existingDispensing = await tx.step.findFirst({
          where: {
            flow_id: flowId,
            step_type: StepTypeEnum.DISPENSING,
            step_status: { not: StepStatusEnum.CANCELLED },
            service_order_id: targetServiceOrderId,
          },
        });

        if (!existingDispensing) {
          const pharmacyRoom = await tx.room.findFirst({
            where: { room_type: ClinicalRoomType.PHARMACY },
            orderBy: { created_at: 'asc' },
          });

          const lastStep = await tx.step.findFirst({
            where: {
              flow_id: flowId,
              parent_step_id: null,
              step_status: { not: StepStatusEnum.CANCELLED },
            },
            orderBy: { created_at: 'desc' },
          });

          const dispensingStep = await tx.step.create({
            data: {
              flow_id: flowId,
              step_type: StepTypeEnum.DISPENSING,
              step_name: `Cấp phát thuốc - ${prescriptionCode}`,
              service_order_id: targetServiceOrderId,
              room_id: pharmacyRoom?.room_id ?? null,
              step_status: StepStatusEnum.PENDING,
            },
          });

          if (lastStep) {
            await tx.step_Dependency.create({
              data: {
                step_id: dispensingStep.step_id,
                depends_on_step_id: lastStep.step_id,
              },
            });
          }
        }
      }

      return prescription;
    });
  }

  async findAll(query: {
    patient_id?: string;
    visit_session_id?: string;
    status?: PrescriptionStatusEnum;
    page?: number;
    limit?: number;
    date?: string;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.visit_session_id) {
      where.visit_session_id = query.visit_session_id;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.patient_id) {
      where.visitSession = {
        patient_id: query.patient_id,
      };
    }

    if (query.date) {
      const timeZone = 'Asia/Ho_Chi_Minh';
      const startOfDay = toDate(`${query.date}T00:00:00`, { timeZone });
      const endOfDay = toDate(`${query.date}T23:59:59.999`, { timeZone });

      where.created_at = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    const [data, total] = await Promise.all([
      this.prismaService.prescription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          serviceOrder: true,
          visitSession: {
            select: {
              visit_session_id: true,
              visit_date: true,
              diagnosis: true,
              patient: {
                select: {
                  patient_id: true,
                  full_name: true,
                  citizen_id: true,
                  gender: true,
                  dob: true,
                },
              },
            },
          },
          doctor: {
            select: DOCTOR_SELECT,
          },
          prescriptionDetails: {
            include: {
              medicine: true,
            },
          },
        },
      }),
      this.prismaService.prescription.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, currentUser?: any) {
    const prescription = await this.prismaService.prescription.findUnique({
      where: { prescription_id: id },
      include: {
        serviceOrder: true,
        visitSession: {
          select: {
            visit_session_id: true,
            visit_date: true,
            chief_complaint: true,
            diagnosis: true,
            patient: {
              select: {
                patient_id: true,
                account_id: true,
                full_name: true,
                citizen_id: true,
                gender: true,
                dob: true,
              },
            },
          },
        },
        doctor: {
          select: DOCTOR_SELECT,
        },
        prescriptionDetails: {
          include: {
            medicine: true,
          },
        },
      },
    });

    if (!prescription) {
      throw new NotFoundException(`Không tìm thấy đơn thuốc với ID: ${id}`);
    }

    if (currentUser && currentUser.role === 'USER') {
      const patientAccountId = prescription.visitSession?.patient?.account_id;
      const currentUserId = currentUser.id || currentUser.sub;
      if (patientAccountId !== currentUserId) {
        throw new ForbiddenException(
          'Bạn không có quyền truy cập đơn thuốc của người khác.',
        );
      }
    }

    return prescription;
  }

  async findByCode(code: string, currentUser?: any) {
    const prescription = await this.prismaService.prescription.findFirst({
      where: {
        OR: [{ prescription_code: code }],
      },
      include: {
        serviceOrder: true,
        visitSession: {
          select: {
            visit_session_id: true,
            visit_date: true,
            chief_complaint: true,
            diagnosis: true,
            patient: {
              select: {
                patient_id: true,
                account_id: true,
                full_name: true,
                citizen_id: true,
                gender: true,
                dob: true,
              },
            },
          },
        },
        doctor: {
          select: DOCTOR_SELECT,
        },
        prescriptionDetails: {
          include: {
            medicine: true,
          },
        },
      },
    });

    if (!prescription) {
      throw new NotFoundException(
        `Không tìm thấy đơn thuốc phù hợp với mã: ${code}`,
      );
    }

    if (currentUser && currentUser.role === 'USER') {
      const patientAccountId = prescription.visitSession?.patient?.account_id;
      const currentUserId = currentUser.id || currentUser.sub;
      if (patientAccountId !== currentUserId) {
        throw new ForbiddenException(
          'Bạn không có quyền truy cập đơn thuốc này.',
        );
      }
    }

    return prescription;
  }

  async findByVisitSession(visitSessionId: string, currentUser?: any) {
    const prescription = await this.prismaService.prescription.findUnique({
      where: { visit_session_id: visitSessionId },
      include: {
        serviceOrder: true,
        visitSession: {
          select: {
            visit_session_id: true,
            visit_date: true,
            chief_complaint: true,
            diagnosis: true,
            patient: {
              select: {
                patient_id: true,
                account_id: true,
                full_name: true,
                citizen_id: true,
                gender: true,
                dob: true,
              },
            },
          },
        },
        doctor: {
          select: DOCTOR_SELECT,
        },
        prescriptionDetails: {
          include: {
            medicine: true,
          },
        },
      },
    });

    if (!prescription) {
      throw new NotFoundException(
        `Phiên khám '${visitSessionId}' chưa có đơn thuốc.`,
      );
    }

    if (currentUser && currentUser.role === 'USER') {
      const patientAccountId = prescription.visitSession?.patient?.account_id;
      const currentUserId = currentUser.id || currentUser.sub;
      if (patientAccountId !== currentUserId) {
        throw new ForbiddenException(
          'Bạn không có quyền truy cập đơn thuốc này.',
        );
      }
    }

    return prescription;
  }

  async confirmOfflinePayment(id: string) {
    const prescription = await this.prismaService.prescription.findUnique({
      where: { prescription_id: id },
      include: {
        visitSession: {
          include: { patient: true },
        },
      },
    });

    if (!prescription) {
      throw new NotFoundException(`Không tìm thấy đơn thuốc với ID: ${id}`);
    }

    if (prescription.status !== PrescriptionStatusEnum.PENDING) {
      throw new BadRequestException(
        `Đơn thuốc '${prescription.prescription_code}' đã được thanh toán hoặc xử lý trước đó.`,
      );
    }

    const patientAccountId = prescription.visitSession?.patient?.account_id;

    if (!patientAccountId) {
      throw new BadRequestException(
        'Không tìm thấy tài khoản bệnh nhân để ghi nhận giao dịch.',
      );
    }

    const docNo = parseInt(
      `${Date.now().toString().slice(-4)}${randomInt(10, 99)}`,
    );

    return this.prismaService.$transaction(async (tx) => {
      if (prescription.service_order_id) {
        await tx.service_Order.update({
          where: { service_order_id: prescription.service_order_id },
          data: {
            payment_status: PaymentStatusEnum.SUCCESSED,
            status: ServiceOrderStatusEnum.IN_PROGRESS,
          },
        });

        await tx.step.updateMany({
          where: { service_order_id: prescription.service_order_id },
          data: { step_status: StepStatusEnum.IN_PROGRESS },
        });

        await tx.transaction.create({
          data: {
            buyerId: patientAccountId,
            docNo: docNo,
            transType: TransTypeEnum.ORDER_PAYMENT,
            amount: prescription.total_amount,
            status: TransStatusEnum.SUCCESSED,
            service_order_id: prescription.service_order_id,
          },
        });
      }

      const pickup = prescription.pickup_number
        ? {
            pickup_number: prescription.pickup_number,
            pickup_date: prescription.pickup_date,
          }
        : await this.allocateNextPickupNumber(tx);

      return tx.prescription.update({
        where: { prescription_id: id },
        data: {
          status: PrescriptionStatusEnum.PROCESSING,
          pickup_number: pickup.pickup_number,
          pickup_date: pickup.pickup_date,
        },
        include: {
          serviceOrder: true,
          prescriptionDetails: {
            include: { medicine: true },
          },
        },
      });
    });
  }

  async markAsPrepared(id: string) {
    const prescription = await this.prismaService.prescription.findUnique({
      where: { prescription_id: id },
      include: {
        visitSession: {
          include: { patient: true },
        },
      },
    });

    if (!prescription) {
      throw new NotFoundException(`Không tìm thấy đơn thuốc với ID: ${id}`);
    }

    if (prescription.status !== PrescriptionStatusEnum.PROCESSING) {
      throw new BadRequestException(
        'Đơn thuốc phải ở trạng thái PROCESSING (đã thanh toán) trước khi đánh dấu soạn xong.',
      );
    }

    const patientAccountId = prescription.visitSession?.patient?.account_id;

    const result = await this.prismaService.$transaction(async (tx) => {
      const updated = await tx.prescription.update({
        where: { prescription_id: id },
        data: { status: PrescriptionStatusEnum.PREPARED },
        include: {
          serviceOrder: true,
          prescriptionDetails: {
            include: { medicine: true },
          },
        },
      });

      if (patientAccountId) {
        const pickupLabel = updated.pickup_number
          ? ` số ${updated.pickup_number}`
          : '';
        await tx.notification.create({
          data: {
            account_id: patientAccountId,
            message: `Đơn thuốc [${prescription.prescription_code}]${pickupLabel} của bạn đã được soạn xong. Vui lòng tới quầy nhà thuốc để nhận thuốc!`,
          },
        });
      }

      return updated;
    });
    void this.emitPharmacyDisplay();
    return result;
  }

  async markAsDispensed(id: string) {
    const prescription = await this.prismaService.prescription.findUnique({
      where: { prescription_id: id },
      include: {
        visitSession: {
          include: { patient: true },
        },
      },
    });

    if (!prescription) {
      throw new NotFoundException(`Không tìm thấy đơn thuốc với ID: ${id}`);
    }

    if (prescription.status !== PrescriptionStatusEnum.PREPARED) {
      throw new BadRequestException(
        'Đơn thuốc phải ở trạng thái PREPARED (đã soạn xong) trước khi giao cho bệnh nhân.',
      );
    }

    const patientAccountId = prescription.visitSession?.patient?.account_id;

    const result = await this.prismaService.$transaction(async (tx) => {
      if (prescription.service_order_id) {
        await tx.service_Order.update({
          where: { service_order_id: prescription.service_order_id },
          data: { status: ServiceOrderStatusEnum.COMPLETED },
        });

        await tx.step.updateMany({
          where: { service_order_id: prescription.service_order_id },
          data: { step_status: StepStatusEnum.COMPLETED },
        });

        if (prescription.flow_id) {
          const unfinishedSteps = await tx.step.count({
            where: {
              flow_id: prescription.flow_id,
              step_status: {
                notIn: [
                  StepStatusEnum.COMPLETED,
                  StepStatusEnum.DECLINED,
                  StepStatusEnum.CANCELLED,
                ],
              },
            },
          });
          if (unfinishedSteps === 0) {
            await tx.flow.update({
              where: { flow_id: prescription.flow_id },
              data: { status: FlowStatusEnum.COMPLETED },
            });
          }
        }
      }

      const updated = await tx.prescription.update({
        where: { prescription_id: id },
        data: { status: PrescriptionStatusEnum.DISPENSED },
        include: {
          serviceOrder: true,
          prescriptionDetails: {
            include: { medicine: true },
          },
        },
      });

      if (patientAccountId) {
        await tx.notification.create({
          data: {
            account_id: patientAccountId,
            message: `Đơn thuốc [${prescription.prescription_code}] của bạn đã được giao thành công. Chúc bạn mau khỏe!`,
          },
        });
      }

      return updated;
    });
    void this.emitPharmacyDisplay();
    return result;
  }

  async updateStatus(id: string, status: PrescriptionStatusEnum) {
    const prescription = await this.prismaService.prescription.findUnique({
      where: { prescription_id: id },
    });

    if (!prescription) {
      throw new NotFoundException(`Không tìm thấy đơn thuốc với ID: ${id}`);
    }

    return this.prismaService.prescription.update({
      where: { prescription_id: id },
      data: { status },
      include: {
        prescriptionDetails: {
          include: {
            medicine: true,
          },
        },
      },
    });
  }

  async update(id: string, updateDto: UpdatePrescriptionDto) {
    const prescription = await this.prismaService.prescription.findUnique({
      where: { prescription_id: id },
    });

    if (!prescription) {
      throw new NotFoundException(`Không tìm thấy đơn thuốc với ID: ${id}`);
    }

    if (prescription.status !== PrescriptionStatusEnum.PENDING) {
      throw new BadRequestException(
        'Chỉ có thể chỉnh sửa đơn thuốc khi ở trạng thái PENDING.',
      );
    }

    const { diagnosis_note, details } = updateDto;

    if (!details) {
      return this.prismaService.prescription.update({
        where: { prescription_id: id },
        data: { diagnosis_note },
      });
    }

    const medicineIds = details.map((d) => d.medicine_id);
    const medicines = await this.prismaService.medicine.findMany({
      where: { medicine_id: { in: medicineIds } },
    });

    const medicineMap = new Map(medicines.map((m) => [m.medicine_id, m]));

    for (const item of details) {
      const med = medicineMap.get(item.medicine_id);
      if (!med) {
        throw new NotFoundException(
          `Không tìm thấy loại thuốc với ID: ${item.medicine_id}`,
        );
      }
    }

    let totalAmount = 0;
    const preparedDetails = details.map((item) => {
      const med = medicineMap.get(item.medicine_id)!;
      const unitPrice = med.unit_price || 0;
      const subTotal = unitPrice * item.quantity;
      totalAmount += subTotal;

      return {
        prescription_id: id,
        medicine_id: item.medicine_id,
        quantity: item.quantity,
        dosage_instruction: item.dosage_instruction,
        unit_price: unitPrice,
        sub_total: subTotal,
        note: item.note,
      };
    });

    const qrCodePayload = this.buildQrPayload({
      code: prescription.prescription_code,
      visit_session_id: prescription.visit_session_id,
      service_order_id: prescription.service_order_id,
      total_amount: totalAmount,
    });

    return this.prismaService.$transaction(async (tx) => {
      await tx.prescription_Detail.deleteMany({
        where: { prescription_id: id },
      });

      await tx.prescription_Detail.createMany({
        data: preparedDetails,
      });

      if (prescription.service_order_id) {
        await tx.service_Order.update({
          where: { service_order_id: prescription.service_order_id },
          data: {
            name: `Đơn thuốc - ${prescription.prescription_code}`,
          },
        });
      }

      return tx.prescription.update({
        where: { prescription_id: id },
        data: {
          diagnosis_note,
          total_amount: totalAmount,
          qr_code: qrCodePayload,
        },
        include: {
          doctor: {
            select: DOCTOR_SELECT,
          },
          prescriptionDetails: {
            include: {
              medicine: true,
            },
          },
        },
      });
    });
  }

  async remove(id: string) {
    const prescription = await this.prismaService.prescription.findUnique({
      where: { prescription_id: id },
    });

    if (!prescription) {
      throw new NotFoundException(`Không tìm thấy đơn thuốc với ID: ${id}`);
    }

    if (prescription.status !== PrescriptionStatusEnum.PENDING) {
      throw new BadRequestException(
        'Chỉ có thể xóa đơn thuốc khi ở trạng thái PENDING.',
      );
    }

    return this.prismaService.prescription.delete({
      where: { prescription_id: id },
    });
  }

  async assignPickupNumbersByServiceOrder(serviceOrderId: string) {
    const prescriptions = await this.prismaService.prescription.findMany({
      where: {
        service_order_id: serviceOrderId,
        pickup_number: null,
      },
      select: { prescription_id: true },
    });

    for (const item of prescriptions) {
      await this.assignPickupNumberToPrescription(item.prescription_id);
    }
  }

  async getPharmacyDisplayPayload(roomId?: string) {
    const room = await this.resolvePharmacyRoom(roomId);
    const today = this.vnTodayDateOnly();

    const [calling, readyUnshownCount] = await Promise.all([
      this.prismaService.prescription.findMany({
        where: {
          status: PrescriptionStatusEnum.PREPARED,
          pickup_date: today,
          pickup_number: { not: null },
          called_at: { not: null },
          missed_at: null,
        },
        select: {
          prescription_id: true,
          pickup_number: true,
          called_at: true,
        },
        orderBy: [{ called_at: 'asc' }],
      }),
      this.prismaService.prescription.count({
        where: {
          status: PrescriptionStatusEnum.PREPARED,
          pickup_date: today,
          pickup_number: { not: null },
          called_at: null,
          missed_at: null,
        },
      }),
    ]);

    const callingNumbers = [...calling].sort((a, b) => {
      const seqDiff =
        this.parsePickupSeq(a.pickup_number) -
        this.parsePickupSeq(b.pickup_number);
      if (seqDiff !== 0) return seqDiff;
      const aTime = a.called_at?.getTime() ?? 0;
      const bTime = b.called_at?.getTime() ?? 0;
      return aTime - bTime;
    });

    return {
      kind: 'pharmacy' as const,
      room: {
        room_id: room.room_id,
        room_name: room.room_name,
        room_type: room.room_type,
      },
      calling_numbers: callingNumbers.map((item) => ({
        prescription_id: item.prescription_id,
        pickup_number: item.pickup_number as string,
      })),
      ready_unshown_count: readyUnshownCount,
    };
  }

  async callNextPrepared(roomId?: string) {
    const room = await this.resolvePharmacyRoom(roomId);
    const today = this.vnTodayDateOnly();
    const now = new Date();

    const result = await this.prismaService.prescription.updateMany({
      where: {
        status: PrescriptionStatusEnum.PREPARED,
        pickup_date: today,
        pickup_number: { not: null },
        called_at: null,
        missed_at: null,
      },
      data: { called_at: now },
    });

    const payload = await this.getPharmacyDisplayPayload(room.room_id);
    this.queueGateway.emitPharmacyDisplayUpdate(room.room_id, payload);

    return {
      called_count: result.count,
      ...payload,
    };
  }

  async missPrepared(id: string) {
    const prescription = await this.prismaService.prescription.findUnique({
      where: { prescription_id: id },
    });

    if (!prescription) {
      throw new NotFoundException(`Không tìm thấy đơn thuốc với ID: ${id}`);
    }

    if (prescription.status !== PrescriptionStatusEnum.PREPARED) {
      throw new BadRequestException(
        'Chỉ có thể đánh miss đơn thuốc đang ở trạng thái PREPARED.',
      );
    }

    if (!prescription.called_at || prescription.missed_at) {
      throw new BadRequestException(
        'Đơn thuốc này không đang hiển thị trên TV nhà thuốc.',
      );
    }

    const updated = await this.prismaService.prescription.update({
      where: { prescription_id: id },
      data: { missed_at: new Date() },
      include: {
        visitSession: {
          select: {
            patient: { select: { full_name: true } },
          },
        },
        prescriptionDetails: { include: { medicine: true } },
      },
    });

    void this.emitPharmacyDisplay();
    return updated;
  }

  async recallPrepared(id: string) {
    const prescription = await this.prismaService.prescription.findUnique({
      where: { prescription_id: id },
    });

    if (!prescription) {
      throw new NotFoundException(`Không tìm thấy đơn thuốc với ID: ${id}`);
    }

    if (prescription.status !== PrescriptionStatusEnum.PREPARED) {
      throw new BadRequestException(
        'Chỉ có thể gọi lại đơn thuốc đang ở trạng thái PREPARED.',
      );
    }

    if (!prescription.missed_at) {
      throw new BadRequestException(
        'Đơn thuốc này không ở trạng thái Miss. Dùng Call next để đưa số lên TV.',
      );
    }

    const updated = await this.prismaService.prescription.update({
      where: { prescription_id: id },
      data: {
        missed_at: null,
        called_at: new Date(),
      },
      include: {
        visitSession: {
          select: {
            patient: { select: { full_name: true } },
          },
        },
        prescriptionDetails: { include: { medicine: true } },
      },
    });

    void this.emitPharmacyDisplay();
    return updated;
  }

  private async assignPickupNumberToPrescription(id: string) {
    const maxRetries = 5;
    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      try {
        return await this.prismaService.$transaction(async (tx) => {
          const current = await tx.prescription.findUnique({
            where: { prescription_id: id },
          });
          if (!current) {
            throw new NotFoundException(
              `Không tìm thấy đơn thuốc với ID: ${id}`,
            );
          }
          if (current.pickup_number) {
            return current;
          }
          const pickup = await this.allocateNextPickupNumber(tx);
          return tx.prescription.update({
            where: { prescription_id: id },
            data: {
              pickup_number: pickup.pickup_number,
              pickup_date: pickup.pickup_date,
            },
          });
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          attempt < maxRetries - 1
        ) {
          continue;
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException(
            'Không thể cấp số lấy thuốc vì bị trùng. Vui lòng thử lại.',
          );
        }
        throw error;
      }
    }
    throw new ConflictException(
      'Không thể cấp số lấy thuốc. Vui lòng thử lại.',
    );
  }

  private async allocateNextPickupNumber(tx: DbClient): Promise<{
    pickup_number: string;
    pickup_date: Date;
  }> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(741002019)`;
    const pickupDate = this.vnTodayDateOnly();
    const existing = await tx.prescription.findMany({
      where: {
        pickup_date: pickupDate,
        pickup_number: { not: null },
      },
      select: { pickup_number: true },
    });

    const maxSeq = existing.reduce(
      (acc, item) => Math.max(acc, this.parsePickupSeq(item.pickup_number)),
      0,
    );

    if (maxSeq >= MAX_PICKUP_SEQ) {
      throw new BadRequestException(
        'Đã hết số lấy thuốc trong ngày (tối đa P999).',
      );
    }

    return {
      pickup_number: `P${maxSeq + 1}`,
      pickup_date: pickupDate,
    };
  }

  private parsePickupSeq(pickupNumber: string | null | undefined): number {
    if (!pickupNumber) return 0;
    const match = PICKUP_NUMBER_RE.exec(pickupNumber);
    return match ? Number.parseInt(match[1], 10) : 0;
  }

  private vnTodayDateOnly(): Date {
    const dateStr = formatInTimeZone(new Date(), VN_TZ, 'yyyy-MM-dd');
    return new Date(`${dateStr}T00:00:00.000Z`);
  }

  private async resolvePharmacyRoom(roomId?: string) {
    if (roomId) {
      const room = await this.prismaService.room.findUnique({
        where: { room_id: roomId },
        select: {
          room_id: true,
          room_name: true,
          room_type: true,
        },
      });
      if (!room) {
        throw new NotFoundException(`Không tìm thấy phòng với ID: ${roomId}`);
      }
      if (room.room_type !== ClinicalRoomType.PHARMACY) {
        throw new BadRequestException(
          'Phòng này không phải nhà thuốc. Hãy chọn phòng loại PHARMACY.',
        );
      }
      return room;
    }

    const room = await this.prismaService.room.findFirst({
      where: { room_type: ClinicalRoomType.PHARMACY },
      orderBy: { created_at: 'asc' },
      select: {
        room_id: true,
        room_name: true,
        room_type: true,
      },
    });

    if (!room) {
      throw new NotFoundException(
        'Chưa cấu hình phòng nhà thuốc (room_type = PHARMACY).',
      );
    }

    return room;
  }

  private async emitPharmacyDisplay(roomId?: string) {
    try {
      const payload = await this.getPharmacyDisplayPayload(roomId);
      this.queueGateway.emitPharmacyDisplayUpdate(
        payload.room.room_id,
        payload,
      );
    } catch (error: any) {
      this.logger.warn(
        `Không phát được TV nhà thuốc: ${error?.message || error}`,
      );
    }
  }
}
