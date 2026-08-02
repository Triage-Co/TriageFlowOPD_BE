import {
  Controller,
  Get,
  Headers,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CronService } from './cron.service';
import {
  ApiBearerAuth,
  ApiExcludeController,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import envInstance from '../../shared/config/env.config';
import { IsRoleGuard } from '../../shared/guards/is-role.guard';
import { roles } from '../../shared/decorator/role.decorator';

@Controller('cron')
export class CronController {
  constructor(private readonly cronService: CronService) {}

  @Get('update-flows')
  @ApiBearerAuth()
  @roles('ADMIN')
  @UseGuards(IsRoleGuard)
  updateFlowAndStepExpiredWithCron() {
    return this.cronService.updateFlowAndStepExpired();
  }

  @Get('update-transactions')
  @ApiBearerAuth()
  @roles('ADMIN')
  @UseGuards(IsRoleGuard)
  updateTransactionStatusWithCron() {
    return this.cronService.updateTransactionStatus();
  }

  @Get('update-prescriptions')
  @ApiBearerAuth()
  @roles('ADMIN')
  @UseGuards(IsRoleGuard)
  updatePrescriptionExpiredWithCron() {
    return this.cronService.updatePrescriptionExpired();
  }

  @Get('update-flow')
  @ApiExcludeEndpoint()
  updateFlowAndStepExpired(@Headers('authorization') authHeader: string) {
    if (authHeader != `Bearer ${envInstance.CRON_SECRET}`) {
      throw new UnauthorizedException(
        'Chỉ hệ thống Cron mới được quyền gọi API này',
      );
    }
    return this.cronService.updateFlowAndStepExpired();
  }

  @Get('update-transaction')
  @ApiExcludeEndpoint()
  updateTransactionStatus(@Headers('authorization') authHeader: string) {
    if (authHeader != `Bearer ${envInstance.CRON_SECRET}`) {
      throw new UnauthorizedException(
        'Chỉ hệ thống Cron mới được quyền gọi API này',
      );
    }
    return this.cronService.updateTransactionStatus();
  }

  @Get('update-prescription')
  @ApiExcludeEndpoint()
  updatePrescriptionExpired(@Headers('authorization') authHeader: string) {
    if (authHeader != `Bearer ${envInstance.CRON_SECRET}`) {
      throw new UnauthorizedException(
        'Chỉ hệ thống Cron mới được quyền gọi API này',
      );
    }
    return this.cronService.updatePrescriptionExpired();
  }
}
