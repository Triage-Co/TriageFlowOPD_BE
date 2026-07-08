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
  ],
})
export class SharedModule {}
