import {
  Controller,
  Get,
  Param,
  Delete,
  Req,
} from '@nestjs/common';
import { NotificationService } from './notification.service';


@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  findAll(@Req() req: any) {
    const { id } = req['user'];
    return this.notificationService.findAll(id);
  }

  @Delete('all')
  removeAll(@Req() req: any) {
    const { id } = req['user'];
    return this.notificationService.removeAll(id);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') notification_id: string) {
    const { id } = req['user'];
    return this.notificationService.remove(id, notification_id);
  }
}
