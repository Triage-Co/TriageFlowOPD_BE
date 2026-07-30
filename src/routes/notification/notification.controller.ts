import { Controller, Get, Param, Delete, Req, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

@ApiBearerAuth()
@UseGuards(IsAuthGuard)
@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  findAll(@Req() req: any) {
    const id = req.user.id || req.user.sub;
    return this.notificationService.findAll(id);
  }

  @Delete('all')
  removeAll(@Req() req: any) {
    const id = req.user.id || req.user.sub;
    return this.notificationService.removeAll(id);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') notification_id: string) {
    const id = req.user.id || req.user.sub;
    return this.notificationService.remove(id, notification_id);
  }
}
