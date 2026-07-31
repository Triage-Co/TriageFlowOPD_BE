import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/config/prisma.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { PaymentStatusEnum, PrescriptionStatusEnum, ServiceOrderStatusEnum, TransStatusEnum, TransTypeEnum } from '@prisma/client';
import { randomInt } from 'crypto';
import { format } from 'date-fns';

@Injectable()
export class PrescriptionService {
  constructor(private readonly prismaService: PrismaService) {}

  private generatePrescriptionCode(): string {
    const dateStr = format(new Date(), 'yyyyMMdd');
    const randomNum = randomInt(1000, 9999);
    return `RX-${dateStr}-${randomNum}`;
  }

  async create(createPrescriptionDto: CreatePrescriptionDto, defaultStaffId?: string) {
    const { visit_session_id, service_order_id, prescribed_by, diagnosis_note, details } = createPrescriptionDto;

    let bookingId: string | undefined = undefined;

    if (visit_session_id) {
      // 1. Kiểm tra xem phiên khám có tồn tại không
      const visitSession = await this.prismaService.visit_Session.findUnique({
        where: { visit_session_id },
        include: { patient: true },
      });

      if (!visitSession) {
        throw new NotFoundException(`Không tìm thấy phiên khám bệnh với ID: ${visit_session_id}`);
      }

      // 2. Kiểm tra xem phiên khám đã có đơn thuốc chưa
      const existingPrescription = await this.prismaService.prescription.findUnique({
        where: { visit_session_id },
      });

      if (existingPrescription) {
        throw new ConflictException(`Phiên khám '${visit_session_id}' đã có đơn thuốc được kê.`);
      }

      bookingId = visitSession.booking_id ?? undefined;
    }

    if (!details || details.length === 0) {
      throw new BadRequestException('Đơn thuốc phải bao gồm ít nhất một loại thuốc.');
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
        throw new NotFoundException(`Không tìm thấy loại thuốc với ID: ${item.medicine_id}`);
      }
      if (!med.is_active) {
        throw new BadRequestException(`Thuốc '${med.medicine_name}' đã ngưng hoạt động.`);
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

      const qrCodePayload = JSON.stringify({
        code: prescriptionCode,
        visit_session_id: visit_session_id || null,
        service_order_id: targetServiceOrderId,
        total_amount: totalAmount,
      });

      const prescription = await tx.prescription.create({
        data: {
          prescription_code: prescriptionCode,
          qr_code: qrCodePayload,
          service_order_id: targetServiceOrderId,
          visit_session_id: visit_session_id || null,
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
            select: {
              staff_id: true,
              full_name: true,
              license_number: true,
            },
          },
          prescriptionDetails: {
            include: {
              medicine: true,
            },
          },
        },
      });

      return prescription;
    });
  }

  async findAll(query: {
    patient_id?: string;
    visit_session_id?: string;
    status?: PrescriptionStatusEnum;
    page?: number;
    limit?: number;
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
            select: {
              staff_id: true,
              full_name: true,
              license_number: true,
            },
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
          select: {
            staff_id: true,
            full_name: true,
            license_number: true,
          },
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
        throw new ForbiddenException('Bạn không có quyền truy cập đơn thuốc của người khác.');
      }
    }

    return prescription;
  }

  async findByCode(code: string, currentUser?: any) {
    const prescription = await this.prismaService.prescription.findFirst({
      where: {
        OR: [
          { prescription_code: code },
          { qr_code: code },
          { prescription_id: code },
        ],
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
          select: {
            staff_id: true,
            full_name: true,
            license_number: true,
          },
        },
        prescriptionDetails: {
          include: {
            medicine: true,
          },
        },
      },
    });

    if (!prescription) {
      throw new NotFoundException(`Không tìm thấy đơn thuốc phù hợp với mã: ${code}`);
    }

    if (currentUser && currentUser.role === 'USER') {
      const patientAccountId = prescription.visitSession?.patient?.account_id;
      const currentUserId = currentUser.id || currentUser.sub;
      if (patientAccountId !== currentUserId) {
        throw new ForbiddenException('Bạn không có quyền truy cập đơn thuốc này.');
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
          select: {
            staff_id: true,
            full_name: true,
            license_number: true,
          },
        },
        prescriptionDetails: {
          include: {
            medicine: true,
          },
        },
      },
    });

    if (!prescription) {
      throw new NotFoundException(`Phiên khám '${visitSessionId}' chưa có đơn thuốc.`);
    }

    if (currentUser && currentUser.role === 'USER') {
      const patientAccountId = prescription.visitSession?.patient?.account_id;
      const currentUserId = currentUser.id || currentUser.sub;
      if (patientAccountId !== currentUserId) {
        throw new ForbiddenException('Bạn không có quyền truy cập đơn thuốc này.');
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
      throw new BadRequestException(`Đơn thuốc '${prescription.prescription_code}' đã được thanh toán hoặc xử lý trước đó.`);
    }

    const patientAccountId = prescription.visitSession?.patient?.account_id;
    const docNo = parseInt(`${Date.now().toString().slice(-4)}${randomInt(10, 99)}`);

    return this.prismaService.$transaction(async (tx) => {
      if (prescription.service_order_id) {
        await tx.service_Order.update({
          where: { service_order_id: prescription.service_order_id },
          data: {
            payment_status: PaymentStatusEnum.SUCCESSED,
            status: ServiceOrderStatusEnum.IN_PROGRESS,
          },
        });

        if (patientAccountId) {
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
      }

      return tx.prescription.update({
        where: { prescription_id: id },
        data: { status: PrescriptionStatusEnum.PROCESSING },
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
      throw new BadRequestException('Đơn thuốc phải ở trạng thái PROCESSING (đã thanh toán) trước khi đánh dấu soạn xong.');
    }

    const patientAccountId = prescription.visitSession?.patient?.account_id;

    return this.prismaService.$transaction(async (tx) => {
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
        await tx.notification.create({
          data: {
            account_id: patientAccountId,
            message: `Đơn thuốc [${prescription.prescription_code}] của bạn đã được soạn xong. Vui lòng tới quầy nhà thuốc để nhận thuốc!`,
          },
        });
      }

      return updated;
    });
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
      throw new BadRequestException('Đơn thuốc phải ở trạng thái PREPARED (đã soạn xong) trước khi giao cho bệnh nhân.');
    }

    const patientAccountId = prescription.visitSession?.patient?.account_id;

    return this.prismaService.$transaction(async (tx) => {
      if (prescription.service_order_id) {
        await tx.service_Order.update({
          where: { service_order_id: prescription.service_order_id },
          data: { status: ServiceOrderStatusEnum.COMPLETED },
        });
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
      throw new BadRequestException('Chỉ có thể chỉnh sửa đơn thuốc khi ở trạng thái PENDING.');
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
        throw new NotFoundException(`Không tìm thấy loại thuốc với ID: ${item.medicine_id}`);
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

    return this.prismaService.$transaction(async (tx) => {
      await tx.prescription_Detail.deleteMany({
        where: { prescription_id: id },
      });

      await tx.prescription_Detail.createMany({
        data: preparedDetails,
      });

      return tx.prescription.update({
        where: { prescription_id: id },
        data: {
          diagnosis_note,
          total_amount: totalAmount,
        },
        include: {
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

    return this.prismaService.prescription.delete({
      where: { prescription_id: id },
    });
  }
}
