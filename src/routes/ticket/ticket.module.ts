import { Module } from '@nestjs/common';
import { TicketController } from './ticket.controller';
import { TicketService } from './ticket.service';
import { SharedModule } from '../../shared/shared.module';
import { NavigationCoreModule } from '../navigation/core/navigation-core.module';

@Module({
  imports: [SharedModule, NavigationCoreModule],
  controllers: [TicketController],
  providers: [TicketService],
  exports: [TicketService],
})
export class TicketModule {}
