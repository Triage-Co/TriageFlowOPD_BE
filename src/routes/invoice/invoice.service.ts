import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoiceStatusEnum,
  PaymentStatusEnum,
  ServiceOrderStatusEnum,
  StepTypeEnum,
  TransStatusEnum,
  TransTypeEnum,
} from '@prisma/client';
import { PrismaService } from '../../shared/config/prisma.service';
import type { IAccountRepository } from '../../shared/interfaces/i-account.repository';
import type { IPatientRepository } from '../../shared/interfaces/i-patient.repository';
import type { IServiceOrderRepository } from '../../shared/interfaces/i-service-order.repository';
import { QueryPatientBillingDto } from './dto/query-patient-billing.dto';

type AuthUser = {
  sub?: string;
  id?: string;
  patient?: { patient_id?: string; [key: string]: unknown };
  [key: string]: unknown;
};

type VisitPaymentStatus = 'PAID' | 'PARTIAL' | 'UNPAID';

type BillingInvoiceRaw = {
  invoice_id: string;
  status: InvoiceStatusEnum;
  payment_method: string | null;
  payment_date: Date | null;
  total_amount: number;
  invoice_details?: Array<{
    invoice_detail_id: string;
    item_name: string;
    quantity: number;
    unit_price: number;
    sub_total: number;
  }>;
};

type BillingTransactionRaw = {
  id: string;
  amount: number;
  transType: TransTypeEnum;
  status: TransStatusEnum;
  transDate: Date;
  docNo: number;
};

type BillingOrderRaw = {
  service_order_id: string;
  booking_id: string | null;
  name: string | null;
  type: StepTypeEnum | null;
  status: ServiceOrderStatusEnum;
  payment_status: PaymentStatusEnum;
  created_at: Date;
  invoices: BillingInvoiceRaw[];
  transactions: BillingTransactionRaw[];
  serviceOrderDetails: Array<{
    name: string | null;
    price_at_order: number | null;
    quantity: number | null;
    service?: {
      service_code: string | null;
      service_name: string | null;
    } | null;
  }>;
  prescription: { total_amount: number } | null;
  booking: {
    booking_id: string;
    patient_id: string;
    created_at: Date;
    visitSession: {
      visit_session_id: string;
      visit_date: Date;
    } | null;
    flow: { ticket_code: string | null } | null;
  } | null;
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const ORPHAN_BOOKING_KEY = '__none__';

@Injectable()
export class InvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('IServiceOrderRepository')
    private readonly serviceOrderRepository: IServiceOrderRepository,
    @Inject('IPatientRepository')
    private readonly patientRepository: IPatientRepository,
    @Inject('IAccountRepository')
    private readonly accountRepository: IAccountRepository,
  ) {}

  async findAll() {
    try {
      const data = await this.prisma.invoice.findMany({
        include: {
          invoice_details: true,
          service_order: {
            include: {
              booking: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });
      return {
        code: 200,
        status: 'success',
        message: 'Lấy danh sách hóa đơn thành công',
        data,
      };
    } catch {
      return {
        code: 500,
        status: 'error',
        message: 'Lỗi khi lấy danh sách hóa đơn',
      };
    }
  }

  async findOne(id: string) {
    try {
      const data = await this.prisma.invoice.findUnique({
        where: { invoice_id: id },
        include: {
          invoice_details: true,
          service_order: {
            include: {
              booking: {
                include: { patient: true },
              },
            },
          },
        },
      });
      if (!data) throw new NotFoundException('Không tìm thấy hóa đơn');
      return {
        code: 200,
        status: 'success',
        message: 'Lấy chi tiết hóa đơn thành công',
        data,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      return {
        code: 500,
        status: 'error',
        message: 'Lỗi khi lấy chi tiết hóa đơn',
      };
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.invoice.delete({
        where: { invoice_id: id },
      });
      return {
        code: 200,
        status: 'success',
        message: 'Xóa hóa đơn thành công',
      };
    } catch {
      return { code: 500, status: 'error', message: 'Lỗi khi xóa hóa đơn' };
    }
  }

  async getPatientBilling(
    patientId: string,
    query: QueryPatientBillingDto,
    reqUser: AuthUser,
  ) {
    await this.assertPatientAccess(patientId, reqUser);

    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const { from, to } = this.resolveDateFilters(query.from, query.to);

    const orders = (await this.serviceOrderRepository.findBillingByPatientId(
      patientId,
      {
        from,
        to,
        paymentStatus: query.payment_status,
      },
    )) as BillingOrderRaw[];

    const visits = this.groupOrdersByVisit(orders, false);
    const summary = this.buildSummary(visits);
    const total = visits.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const pagedVisits = visits.slice((page - 1) * limit, page * limit);

    return {
      code: 200,
      status: 'success',
      message: 'Lấy tổng hợp hóa đơn bệnh nhân thành công',
      data: {
        patient_id: patientId,
        summary,
        meta: {
          page,
          limit,
          total,
          totalPages,
        },
        visits: pagedVisits,
      },
    };
  }

  async getPatientVisitBilling(
    patientId: string,
    bookingId: string,
    reqUser: AuthUser,
  ) {
    await this.assertPatientAccess(patientId, reqUser);

    const { booking, orders } =
      await this.serviceOrderRepository.findBillingByBookingId(bookingId);

    if (!booking || booking.patient_id !== patientId) {
      throw new NotFoundException('Không tìm thấy lần khám của bệnh nhân này');
    }

    const visit = this.buildVisitGroup(
      booking.booking_id,
      orders as BillingOrderRaw[],
      booking,
      true,
    );

    return {
      code: 200,
      status: 'success',
      message: 'Lấy chi tiết hóa đơn lần khám thành công',
      data: {
        patient_id: patientId,
        visit,
      },
    };
  }

  private async assertPatientAccess(patientId: string, reqUser: AuthUser) {
    if (!reqUser) {
      throw new ForbiddenException('Không xác định được người dùng đăng nhập');
    }

    // 1. Trường hợp truy cập từ Kiosk:
    // Token Kiosk chứa thông tin bệnh nhân (trường patient hoặc sub/id là patient_id)
    const isKioskPatient =
      reqUser.patient?.patient_id === patientId ||
      reqUser.sub === patientId ||
      reqUser.id === patientId;

    if (isKioskPatient) {
      const patient =
        await this.patientRepository.findOneWithPatientId(patientId);
      if (!patient) {
        throw new NotFoundException('Không tìm thấy hồ sơ bệnh nhân');
      }
      return;
    }

    // Nếu là token Kiosk nhưng đang cố truy cập patientId của người khác
    if (reqUser.patient) {
      throw new ForbiddenException(
        'Bạn không có quyền xem hóa đơn của bệnh nhân này',
      );
    }

    // 2. Trường hợp truy cập từ Web/App tài khoản (USER / STAFF):
    const accountId = reqUser.sub || reqUser.id;
    if (!accountId) {
      throw new ForbiddenException('Không xác định được tài khoản đăng nhập');
    }

    const account: unknown = await this.accountRepository.findById(accountId);
    if (!account) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    if (this.isUserRole(account)) {
      const ownedPatient: unknown = await this.patientRepository.findOne(
        patientId,
        accountId,
      );
      if (!ownedPatient) {
        throw new ForbiddenException(
          'Bạn không có quyền xem hóa đơn của bệnh nhân này',
        );
      }
      return;
    }

    const patient: unknown =
      await this.patientRepository.findOneWithPatientId(patientId);
    if (!patient) {
      throw new NotFoundException('Không tìm thấy hồ sơ bệnh nhân');
    }
  }

  private isUserRole(account: unknown): boolean {
    return (
      typeof account === 'object' &&
      account !== null &&
      'role' in account &&
      account.role === 'USER'
    );
  }

  private resolveDateFilters(
    from?: string,
    to?: string,
  ): { from?: Date; to?: Date } {
    return {
      from: from ? this.parseDateBoundary(from, 'start') : undefined,
      to: to ? this.parseDateBoundary(to, 'end') : undefined,
    };
  }

  private parseDateBoundary(value: string, bound: 'start' | 'end'): Date {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const time = bound === 'start' ? '00:00:00.000' : '23:59:59.999';
      return new Date(`${value}T${time}+07:00`);
    }
    return new Date(value);
  }

  private groupOrdersByVisit(orders: BillingOrderRaw[], detailed: boolean) {
    const grouped = new Map<string, BillingOrderRaw[]>();

    for (const order of orders) {
      const key = order.booking_id ?? ORPHAN_BOOKING_KEY;
      const bucket = grouped.get(key);
      if (bucket) {
        bucket.push(order);
      } else {
        grouped.set(key, [order]);
      }
    }

    const visits = Array.from(grouped.entries()).map(([key, groupOrders]) =>
      this.buildVisitGroup(
        key === ORPHAN_BOOKING_KEY ? null : key,
        groupOrders,
        groupOrders[0]?.booking ?? null,
        detailed,
      ),
    );

    return visits.sort(
      (a, b) =>
        new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime(),
    );
  }

  private buildVisitGroup(
    bookingId: string | null,
    orders: BillingOrderRaw[],
    bookingMeta: BillingOrderRaw['booking'] | null,
    detailed: boolean,
  ) {
    const paidFlags = orders.map((order) => this.isOrderPaid(order));
    const mappedOrders = orders.map((order) => this.mapOrder(order, detailed));
    const totalAmount = mappedOrders.reduce(
      (sum, order) => sum + order.amount,
      0,
    );
    const paidAmount = mappedOrders.reduce(
      (sum, order, index) => sum + (paidFlags[index] ? order.amount : 0),
      0,
    );

    return {
      booking_id: bookingId ?? bookingMeta?.booking_id ?? null,
      visit_session_id: bookingMeta?.visitSession?.visit_session_id ?? null,
      visit_date: (
        bookingMeta?.visitSession?.visit_date ??
        bookingMeta?.created_at ??
        orders[0]?.created_at ??
        new Date()
      ).toISOString(),
      ticket_code: bookingMeta?.flow?.ticket_code ?? null,
      visit_payment_status: this.resolveVisitPaymentStatus(paidFlags),
      total_amount: totalAmount,
      paid_amount: paidAmount,
      unpaid_amount: totalAmount - paidAmount,
      orders: mappedOrders,
    };
  }

  private mapOrder(order: BillingOrderRaw, detailed: boolean) {
    const amount = this.resolveOrderAmount(order);
    const invoice = this.pickInvoice(order.invoices);
    const latestTransaction = this.pickLatestTransaction(order.transactions);

    const base = {
      service_order_id: order.service_order_id,
      name: order.name,
      type: order.type,
      order_status: order.status,
      payment_status: order.payment_status,
      amount,
      invoice: invoice
        ? {
            invoice_id: invoice.invoice_id,
            status: invoice.status,
            payment_method: invoice.payment_method,
            payment_date: invoice.payment_date,
            total_amount: invoice.total_amount,
            ...(detailed
              ? { invoice_details: invoice.invoice_details ?? [] }
              : {}),
          }
        : null,
      latest_transaction: latestTransaction
        ? {
            id: latestTransaction.id,
            amount: latestTransaction.amount,
            transType: latestTransaction.transType,
            status: latestTransaction.status,
            transDate: latestTransaction.transDate,
            docNo: latestTransaction.docNo,
          }
        : null,
    };

    if (!detailed) {
      return base;
    }

    return {
      ...base,
      invoices: order.invoices.map((item) => ({
        invoice_id: item.invoice_id,
        status: item.status,
        payment_method: item.payment_method,
        payment_date: item.payment_date,
        total_amount: item.total_amount,
        invoice_details: item.invoice_details ?? [],
      })),
      transactions: order.transactions.map((item) => ({
        id: item.id,
        amount: item.amount,
        transType: item.transType,
        status: item.status,
        transDate: item.transDate,
        docNo: item.docNo,
      })),
      service_order_details: order.serviceOrderDetails.map((detail) => ({
        name: detail.name || detail.service?.service_name || order.name || null,
        quantity: detail.quantity ?? 1,
        unit_price: detail.price_at_order ?? 0,
        sub_total: (detail.price_at_order ?? 0) * (detail.quantity ?? 1),
      })),
    };
  }

  private resolveOrderAmount(order: BillingOrderRaw): number {
    const invoiceTotal = order.invoices
      .filter((invoice) => invoice.status !== InvoiceStatusEnum.CANCELLED)
      .reduce((sum, invoice) => sum + (invoice.total_amount || 0), 0);

    if (invoiceTotal > 0) {
      return invoiceTotal;
    }

    if (order.prescription?.total_amount) {
      return order.prescription.total_amount;
    }

    return order.serviceOrderDetails.reduce((sum, detail) => {
      return sum + (detail.price_at_order || 0) * (detail.quantity || 1);
    }, 0);
  }

  private isOrderPaid(order: BillingOrderRaw): boolean {
    if (order.payment_status === PaymentStatusEnum.SUCCESSED) {
      return true;
    }
    return order.invoices.some(
      (invoice) => invoice.status === InvoiceStatusEnum.PAID,
    );
  }

  private pickInvoice(invoices: BillingInvoiceRaw[]): BillingInvoiceRaw | null {
    const active = invoices.filter(
      (invoice) => invoice.status !== InvoiceStatusEnum.CANCELLED,
    );
    return (
      active.find((invoice) => invoice.status === InvoiceStatusEnum.PAID) ??
      active[0] ??
      null
    );
  }

  private pickLatestTransaction(
    transactions: BillingTransactionRaw[],
  ): BillingTransactionRaw | null {
    if (transactions.length === 0) {
      return null;
    }

    const succeeded = transactions.filter(
      (transaction) => transaction.status === TransStatusEnum.SUCCESSED,
    );
    if (succeeded.length > 0) {
      return succeeded[0];
    }

    return transactions[0];
  }

  private resolveVisitPaymentStatus(paidFlags: boolean[]): VisitPaymentStatus {
    if (paidFlags.length === 0) {
      return 'UNPAID';
    }
    const paidCount = paidFlags.filter(Boolean).length;
    if (paidCount === paidFlags.length) {
      return 'PAID';
    }
    if (paidCount === 0) {
      return 'UNPAID';
    }
    return 'PARTIAL';
  }

  private buildSummary(
    visits: Array<{
      total_amount: number;
      paid_amount: number;
      unpaid_amount: number;
      orders: unknown[];
    }>,
  ) {
    return {
      visit_count: visits.length,
      order_count: visits.reduce((sum, visit) => sum + visit.orders.length, 0),
      total_amount: visits.reduce((sum, visit) => sum + visit.total_amount, 0),
      paid_amount: visits.reduce((sum, visit) => sum + visit.paid_amount, 0),
      unpaid_amount: visits.reduce(
        (sum, visit) => sum + visit.unpaid_amount,
        0,
      ),
    };
  }
}
