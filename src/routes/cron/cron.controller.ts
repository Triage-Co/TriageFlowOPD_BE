import {
  Controller,
  Get,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { CronService } from './cron.service';
import { ApiExcludeController } from '@nestjs/swagger';
import envInstance from '../../shared/config/env.config';

@Controller('cron')
@ApiExcludeController()
export class CronController {
  constructor(private readonly cronService: CronService) {}
  @Get('update-flow')
  updateFlowAndStepExpired(@Headers('authorization') authHeader: string) {
    if (authHeader != `Bearer ${envInstance.CRON_SECRET}`) {
      throw new UnauthorizedException(
        'Chỉ hệ thống Cron mới được quyền gọi API này',
      );
    }
    return this.cronService.updateFlowAndStepExpired();
  }

  @Get('update-transaction')
  updateTransactionStatus(@Headers('authorization') authHeader: string) {
    if (authHeader != `Bearer ${envInstance.CRON_SECRET}`) {
      throw new UnauthorizedException(
        'Chỉ hệ thống Cron mới được quyền gọi API này',
      );
    }
    return this.cronService.updateTransactionStatus();
  }
}
