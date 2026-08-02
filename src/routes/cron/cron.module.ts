import { Module } from '@nestjs/common';
import { CronController } from './cron.controller';
import { CronService } from './cron.service';
// import { CronService } from './cron.service';
// import { CronController } from './cron.controller';

@Module({
  controllers: [CronController],
  providers: [CronService],
})
export class CronModule {}
