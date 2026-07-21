import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Header,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { CronService } from './cron.service';
import { CreateCronDto } from './dto/create-cron.dto';
import { UpdateCronDto } from './dto/update-cron.dto';
import { ApiExcludeController } from '@nestjs/swagger';
import envInstance from '../../shared/config/env.config';

@Controller('cron')
@ApiExcludeController()
export class CronController {
  constructor(private readonly cronService: CronService) {}
  @Patch('/update-flow')
  updateExpired(@Headers('authorization') authHeader: string) {
    if (authHeader != `Bearer ${envInstance.CRON_SECRET}`) {
      throw new UnauthorizedException(
        'Chỉ hệ thống Cron mới được quyền gọi API này',
      );
    }
    return this.cronService.updateExpired();
  }
}
