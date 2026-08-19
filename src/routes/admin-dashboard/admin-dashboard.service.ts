import { Injectable } from '@nestjs/common';
import { QueueStatusEnum } from '@prisma/client';
import { formatInTimeZone, toDate } from 'date-fns-tz';
import { PrismaService } from '../../shared/config/prisma.service';
import { QueueAdminService } from '../queue/queue-admin.service';

const TIME_ZONE = 'Asia/Ho_Chi_Minh';

@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueAdminService: QueueAdminService,
  ) {}

  async getSummary() {
    const now = new Date();
    const todayDateString = formatInTimeZone(now, TIME_ZONE, 'yyyy-MM-dd');
    const startOfDay = toDate(`${todayDateString}T00:00:00`, {
      timeZone: TIME_ZONE,
    });
    const endOfDay = toDate(`${todayDateString}T23:59:59.999`, {
      timeZone: TIME_ZONE,
    });

    const [
      heatmapResult,
      roomsWithShiftToday,
      staffOnShiftToday,
      activeServices,
      queueWaiting,
      queueServing,
      completedToday,
    ] = await Promise.all([
      this.queueAdminService.getHeatmapData(),
      this.prisma.shift.findMany({
        where: { date: { gte: startOfDay, lte: endOfDay } },
        distinct: ['room_id'],
        select: { room_id: true },
      }),
      this.prisma.shift.findMany({
        where: { date: { gte: startOfDay, lte: endOfDay } },
        distinct: ['staff_id'],
        select: { staff_id: true },
      }),
      this.prisma.service.count({ where: { is_active: true } }),
      this.prisma.queue.count({
        where: {
          status: { in: [QueueStatusEnum.QUEUED, QueueStatusEnum.PENDING] },
          created_at: { gte: startOfDay },
        },
      }),
      this.prisma.queue.count({
        where: {
          status: { in: [QueueStatusEnum.SERVING, QueueStatusEnum.CALLED] },
          created_at: { gte: startOfDay },
        },
      }),
      this.prisma.queue.count({
        where: {
          status: QueueStatusEnum.FINISHED,
          created_at: { gte: startOfDay },
        },
      }),
    ]);

    const heatmapRooms: any[] = heatmapResult?.data?.rooms ?? [];
    const busiestRooms = [...heatmapRooms]
      .sort(
        (a, b) =>
          b.waiting_count - a.waiting_count ||
          b.eta_full_queue_minutes - a.eta_full_queue_minutes,
      )
      .slice(0, 5)
      .map((room) => ({
        room_id: room.room_id,
        room_name: room.room_name,
        waiting_count: room.waiting_count,
        eta_full_queue_minutes: room.eta_full_queue_minutes,
        congestion_level: room.congestion_level,
      }));

    return {
      code: 200,
      status: 'success',
      message: 'Lấy tổng quan dashboard admin thành công.',
      data: {
        generated_at: now.toISOString(),
        kpis: {
          rooms_with_shift_today: roomsWithShiftToday.length,
          active_services: activeServices,
          queue_waiting: queueWaiting,
          queue_serving: queueServing,
          completed_today: completedToday,
          staff_on_shift_today: staffOnShiftToday.length,
        },
        busiest_rooms: busiestRooms,
        links: {
          heatmap: '/admin/map?heatmap=1',
        },
      },
    };
  }
}
