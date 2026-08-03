import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SharedModule } from './shared/shared.module';
import { ScheduleModule } from '@nestjs/schedule';

import { MapModule } from './routes/map/map.module';
import { NavigationModule } from './routes/navigation/navigation.module';

import { AuthModule } from './routes/auth/auth.module';
import { ShiftModule } from './routes/shift/shift.module';
import { RoomModule } from './routes/room/room.module';
import { TriageConfigModule } from './routes/triage_config/triage_config.module';
import { TransactionModule } from './routes/transaction/transaction.module';
import { BookingModule } from './routes/booking/booking.module';
import { InfermedicaModule } from './routes/infermedica/infermedica.module';
import { PatientModule } from './routes/patient/patient.module';
import { DoctorModule } from './routes/doctor/doctor.module';
import { NotificationModule } from './routes/notification/notification.module';
import { VnptModule } from './routes/vnpt/vnpt.module';
import { StepModule } from './routes/step/step.module';
import { StaffModule } from './routes/staff/staff.module';
import { AccountModule } from './routes/account/account.module';
import { FlowModule } from './routes/flow/flow.module';
import { SpecialtyModule } from './routes/specialty/specialty.module';
import { VisitSessionModule } from './routes/visit-session/visit-session.module';
import { ClinicalDocumentModule } from './routes/clinical-document/clinical-document.module';

import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { TemplateModule } from './routes/template/template.module';
import { JwtModule } from '@nestjs/jwt';
import { QueueModule } from './routes/queue/queue.module';
import { CronModule } from './routes/cron/cron.module';
import { SentryModule } from '@sentry/nestjs/setup';
import { ServiceModule } from './routes/service/service.module';
import { ServiceOrderModule } from './routes/service_order/service_order.module';
import { ServiceOrderDetailModule } from './routes/service_order_detail/service_order_detail.module';
import { InvoiceModule } from './routes/invoice/invoice.module';
import { InvoiceDetailModule } from './routes/invoice_detail/invoice_detail.module';
import { PharmacyModule } from './routes/pharmacy/pharmacy.module';
import { TicketModule } from './routes/ticket/ticket.module';
import { ExamPackageModule } from './routes/exam-package/exam-package.module';

@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => {
        try {
          const store = await redisStore({
            url: process.env.REDIS_URL,
          });
          return {
            store,
          };
        } catch (error: any) {
          console.warn(
            'Redis connection failed, falling back to in-memory cache:',
            error.message,
          );
          return {
            store: 'memory',
            ttl: 300,
          };
        }
      },
    }),
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    JwtModule.register({
      global: true,
      secret: process.env.KIOSK_KEY,
      signOptions: {
        expiresIn: '12h',
      },
    }),
    ScheduleModule.forRoot(),
    SharedModule,
    MapModule,
    NavigationModule,
    AuthModule,
    JwtModule,
    StaffModule,
    ShiftModule,
    RoomModule,
    BookingModule,
    StepModule,
    TriageConfigModule,
    TransactionModule,
    InfermedicaModule,
    PatientModule,
    DoctorModule,
    NotificationModule,
    VnptModule,
    AccountModule,
    FlowModule,
    SpecialtyModule,
    TemplateModule,
    QueueModule,
    VisitSessionModule,
    ClinicalDocumentModule,
    CronModule,
    ServiceModule,
    ServiceOrderModule,
    ServiceOrderDetailModule,
    InvoiceModule,
    InvoiceDetailModule,
    PharmacyModule,
    TicketModule,
    ExamPackageModule,
  ]
})
export class AppModule { }
