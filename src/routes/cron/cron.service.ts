import { Injectable } from '@nestjs/common';
import { CreateCronDto } from './dto/create-cron.dto';
import { UpdateCronDto } from './dto/update-cron.dto';
import { PrismaService } from '../../shared/config/prisma.service';

@Injectable()
export class CronService {
  constructor(private readonly prismaService: PrismaService) {}
  async updateExpired() {
    let startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const result = await this.prismaService.flow.updateMany({
      where: {
        created_at: {
          lt: startOfDay,
        },
        status: {
          in: ['PENDING', 'IN_PROGRESS'],
        },
      },
      data: {
        status: 'ABANDONED',
      },
    });

    return {
      message: 'Cập nhật trạng thái Flow quá hạn thành công',
      updatedCount: result.count,
    };
  }
}
