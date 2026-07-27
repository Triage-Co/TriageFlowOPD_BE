import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/config/prisma.service';

@Injectable()
export class InvoiceDetailService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    try {
      const data = await this.prisma.invoice_Detail.findMany({
        orderBy: { created_at: 'desc' }
      });
      return { code: 200, status: 'success', message: 'Lấy danh sách chi tiết hóa đơn thành công', data };
    } catch (error) {
      return { code: 500, status: 'error', message: 'Lỗi khi lấy danh sách chi tiết hóa đơn' };
    }
  }

  async findOne(id: string) {
    try {
      const data = await this.prisma.invoice_Detail.findUnique({
        where: { invoice_detail_id: id }
      });
      if (!data) throw new NotFoundException('Không tìm thấy chi tiết hóa đơn');
      return { code: 200, status: 'success', message: 'Lấy chi tiết hóa đơn thành công', data };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      return { code: 500, status: 'error', message: 'Lỗi khi lấy chi tiết hóa đơn' };
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.invoice_Detail.delete({
        where: { invoice_detail_id: id },
      });
      return { code: 200, status: 'success', message: 'Xóa chi tiết hóa đơn thành công' };
    } catch (error) {
      return { code: 500, status: 'error', message: 'Lỗi khi xóa chi tiết hóa đơn' };
    }
  }
}
