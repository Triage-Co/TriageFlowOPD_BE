import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeoService } from './geo/geo.service';
import { SupabaseService } from './config/supabase.service';
import { PrismaService } from './config/prisma.service';
import { PayosService } from './config/payos.service';
import { SupabaseAuthProvider } from './repositories/supabase-auth.provider';
import { PrismaAccountRepository } from './repositories/prisma-account.repository';
import { PrismaPatientRepository } from './repositories/prisma-patient.repository';
import { PrismaStaffRepository } from './repositories/prisma-staff.repository';
import { PrismaRoomRepository } from './repositories/prisma-room.repository';
import { PrismaNotificationRepository } from './repositories/prisma-notification.repository';
import { PrismaStepRepository } from './repositories/prisma-step.repository';
import { PrismaFlowRepository } from './repositories/prisma-flow.repository';
import { PrismaTemplateRepository } from './repositories/prisma-template.repository';
import { PrismaVisitSessionRepository } from './repositories/prisma-visit-session.repository';
import { PrismaClinicalDocumentRepository } from './repositories/prisma-clinical-document.repository';
import { PrismaBookingRepository } from './repositories/prisma-booking.repository';
import { PrismaShiftRepository } from './repositories/prisma-shift.repository';
import { PrismaTriageInformationRepository } from './repositories/prisma-triage-information.repository';

@Global()
@Module({
  providers: [
    ConfigService,
    SupabaseService,
    PrismaService,
    PayosService,
    GeoService,
    {
      provide: 'IAuthProvider',
      useClass: SupabaseAuthProvider,
    },
    {
      provide: 'IAccountRepository',
      useClass: PrismaAccountRepository,
    },
    {
      provide: 'IPatientRepository',
      useClass: PrismaPatientRepository,
    },
    {
      provide: 'IStaffRepository',
      useClass: PrismaStaffRepository,
    },
    {
      provide: 'IRoomRepository',
      useClass: PrismaRoomRepository,
    },
    {
      provide: 'IPatientRepository',
      useClass: PrismaPatientRepository,
    },
    {
      provide: 'INotificationRepository',
      useClass: PrismaNotificationRepository,
    },
    {
      provide: 'IStepRepository',
      useClass: PrismaStepRepository,
    },
    {
      provide: 'IFlowRepository',
      useClass: PrismaFlowRepository,
    },
    {
      provide: 'ITemplateRepository',
      useClass: PrismaTemplateRepository,
    },
    {
      provide: 'IVisitSessionRepository',
      useClass: PrismaVisitSessionRepository,
    },
    {
      provide: 'IClinicalDocumentRepository',
      useClass: PrismaClinicalDocumentRepository,
    },
    {
      provide: 'IBookingRepository',
      useClass: PrismaBookingRepository,
    },
    {
      provide: 'IShiftRepository',
      useClass: PrismaShiftRepository,
    },
    {
      provide: 'ITriageInformationRepository',
      useClass: PrismaTriageInformationRepository,
    },
  ],
  exports: [
    SupabaseService,
    PrismaService,
    PayosService,
    GeoService,
    'IAuthProvider',
    'IAccountRepository',
    'IPatientRepository',
    'IStaffRepository',
    'IRoomRepository',
    'IPatientRepository',
    'INotificationRepository',
    'IStepRepository',
    'IFlowRepository',
    'ITemplateRepository',
    'IVisitSessionRepository',
    'IClinicalDocumentRepository',
    'IBookingRepository',
    'IShiftRepository',
    'ITriageInformationRepository',
  ],
})
export class SharedModule {}
