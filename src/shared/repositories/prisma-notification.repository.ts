import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { INotificationRepository } from '../interfaces/i-notification.repository';

@Injectable()
export class PrismaNotificationRepository implements INotificationRepository {
  constructor(private readonly prismaService: PrismaService) {}
  create(data: any, tx?: any): Promise<any> {
    const context = tx || this.prismaService;
    return context.notification.create({
      data: {
        ...data,
      },
    });
  }
  async findAll(account_id: string, page?: number, limit?: number): Promise<any> {
    const skip = page && limit && page > 0 && limit > 0 ? (Number(page) - 1) * Number(limit) : undefined;
    const take = limit && limit > 0 ? Number(limit) : undefined;

    const [data, total_items] = await Promise.all([
      this.prismaService.notification.findMany({
        where: { account_id: account_id },
        take: take,
        skip: skip,
        orderBy: { created_at: 'desc' },
      }),
      this.prismaService.notification.count({
        where: { account_id: account_id },
      }),
    ]);

    return {
      data,
      meta: {
        total: total_items,
        page: Number(page) || 1,
        limit: take ?? total_items,
        totalPages: take ? Math.ceil(total_items / take) : 1,
      },
    };
  }
  deleteAll(account_id: string): Promise<any> {
    return this.prismaService.notification.deleteMany({
      where: {
        account_id: account_id,
      },
    });
  }
  delete(account_id: string, id: string): Promise<any> {
    return this.prismaService.notification.delete({
      where: {
        id: id,
        account_id: account_id,
      },
    });
  }
}
