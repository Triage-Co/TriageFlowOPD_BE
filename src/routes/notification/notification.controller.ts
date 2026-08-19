import {
  Controller,
  Get,
  Param,
  Delete,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

@ApiBearerAuth()
@UseGuards(IsAuthGuard)
@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Req() req: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const id = req.user.id || req.user.sub;
    return this.notificationService.findAll(id, page, limit);
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
