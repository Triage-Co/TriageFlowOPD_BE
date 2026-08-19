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
  findAll(account_id: string): Promise<any> {
    return this.prismaService.notification.findMany({
      where: {
        account_id: account_id,
      },
    });
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
