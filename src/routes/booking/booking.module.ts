import { Module, forwardRef } from '@nestjs/common';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { TransactionModule } from '../transaction/transaction.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [TransactionModule, forwardRef(() => QueueModule)],
  controllers: [BookingController],
  providers: [BookingService],
})
export class BookingModule {}
