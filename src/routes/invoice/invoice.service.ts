import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/config/prisma.service';

@Injectable()
export class InvoiceService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    try {
      const data = await this.prisma.invoice.findMany({
        include: {
          invoice_details: true,
          service_order: {
            include: {
              bookings: {
                include: { patient: true }
              }
            }
          },
        },
        orderBy: { created_at: 'desc' }
      });
      return { code: 200, status: 'success', message: 'Lấy danh sách hóa đơn thành công', data };
    } catch (error) {
      return { code: 500, status: 'error', message: 'Lỗi khi lấy danh sách hóa đơn' };
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
              bookings: {
                include: { patient: true }
              }
            }
          },
        },
      });
      if (!data) throw new NotFoundException('Không tìm thấy hóa đơn');
      return { code: 200, status: 'success', message: 'Lấy chi tiết hóa đơn thành công', data };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      return { code: 500, status: 'error', message: 'Lỗi khi lấy chi tiết hóa đơn' };
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.invoice.delete({
        where: { invoice_id: id },
      });
      return { code: 200, status: 'success', message: 'Xóa hóa đơn thành công' };
    } catch (error) {
      return { code: 500, status: 'error', message: 'Lỗi khi xóa hóa đơn' };
    }
  }
}
