import { PaymentStatusEnum, Prisma, Service_Order } from '@prisma/client';

export type PatientBillingFilters = {
  from?: Date;
  to?: Date;
  paymentStatus?: PaymentStatusEnum;
};

export type BookingBillingContext = {
  booking: {
    booking_id: string;
    patient_id: string;
    created_at: Date;
    visitSession: {
      visit_session_id: string;
      visit_date: Date;
    } | null;
    flow: {
      flow_id: string;
      ticket_code: string | null;
    } | null;
  } | null;
  orders: any[];
};

export interface IServiceOrderRepository {
  create(
    data: Prisma.Service_OrderUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Service_Order>;
  update(
    id: string,
    data: Prisma.Service_OrderUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Service_Order>;
  findAll(
    page?: number,
    limit?: number,
  ): Promise<{
    data: Partial<Service_Order>[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }>;
  findById(id: string): Promise<any>;
  delete(id: string, tx?: Prisma.TransactionClient): Promise<Service_Order>;
  findPendingByPatientId(patientId: string): Promise<any[]>;
  findOrderServiceByBookingId(booking_id: string): Promise<any[]>;
  findBillingByPatientId(
    patientId: string,
    filters?: PatientBillingFilters,
  ): Promise<any[]>;
  findBillingByBookingId(bookingId: string): Promise<BookingBillingContext>;
}
