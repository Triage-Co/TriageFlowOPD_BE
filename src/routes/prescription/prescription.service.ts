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
import { PrescriptionStatusEnum } from '@prisma/client';

@Injectable()
export class PrescriptionService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(createPrescriptionDto: CreatePrescriptionDto, defaultStaffId?: string) {
    const { visit_session_id, prescribed_by, diagnosis_note, details } = createPrescriptionDto;

    // 1. Kiểm tra xem phiên khám có tồn tại không
    const visitSession = await this.prismaService.visit_Session.findUnique({
      where: { visit_session_id },
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

    // 5. Lưu đơn thuốc và chi tiết đơn thuốc trong transaction
    return this.prismaService.$transaction(async (tx) => {
      const prescription = await tx.prescription.create({
        data: {
          visit_session_id,
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

    // Nếu người dùng có role USER (Bệnh nhân), kiểm tra quyền sở hữu
    if (currentUser && currentUser.role === 'USER') {
      const patientAccountId = prescription.visitSession?.patient?.account_id;
      const currentUserId = currentUser.id || currentUser.sub;
      if (patientAccountId !== currentUserId) {
        throw new ForbiddenException('Bạn không có quyền truy cập đơn thuốc của người khác.');
      }
    }

    return prescription;
  }

  async findByVisitSession(visitSessionId: string, currentUser?: any) {
    const prescription = await this.prismaService.prescription.findUnique({
      where: { visit_session_id: visitSessionId },
      include: {
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

    // Recalculate if details are updated
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
