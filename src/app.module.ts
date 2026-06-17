import { Module } from '@nestjs/common';
import { AuthModule } from './routes/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { SharedModule } from './shared/shared.module';
import { InfermedicaModule } from './routes/infermedica/infermedica.module';
import { PaymentModule } from './routes/payment/payment.module';
import { ScheduleModule } from '@nestjs/schedule'
import { BookingModule } from './routes/booking/booking.module';
import { SpecialtyModule } from './routes/specialty/specialty.module';
import { DoctorModule } from './routes/doctor/doctor.module';
import { ShiftModule } from './routes/shift/shift.module';
import { StepModule } from './routes/step/step.module';
import { FlowModule } from './routes/flow/flow.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    SharedModule,
    InfermedicaModule,
    PaymentModule,
    BookingModule,
    SpecialtyModule,
    DoctorModule,
    ShiftModule,
    StepModule,
    FlowModule],
})
export class AppModule { }
