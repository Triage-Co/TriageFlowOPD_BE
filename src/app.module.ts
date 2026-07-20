import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SharedModule } from './shared/shared.module';
import { ScheduleModule } from '@nestjs/schedule';
import { BuildingModule } from './routes/building/building.module';
import { FloorModule } from './routes/floor/floor.module';
import { PhysicalRoomModule } from './routes/physical-room/physical-room.module';
import { RoomBoundaryModule } from './routes/room-boundary/room-boundary.module';
import { ClinicModule } from './routes/clinic/clinic.module';
import { ClinicBoundaryModule } from './routes/clinic-boundary/clinic-boundary.module';
import { DoorModule } from './routes/door/door.module';
import { CategoryModule } from './routes/category/category.module';
import { PoiModule } from './routes/poi/poi.module';
import { NodeModule } from './routes/node/node.module';
import { EdgeModule } from './routes/edge/edge.module';
import { ConnectorModule } from './routes/connector/connector.module';
import { GraphModule } from './routes/graph/graph.module';
import { FeatureTemplateModule } from './routes/feature-template/feature-template.module';
import { PlacedFeatureModule } from './routes/placed-feature/placed-feature.module';
import { BlockageModule } from './routes/blockage/blockage.module';
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
import { NavigationModule } from './routes/navigation/navigation.module';
import { TemplateModule } from './routes/template/template.module';
import { JwtModule } from '@nestjs/jwt';
import { QueueModule } from './routes/queue/queue.module';

@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => {
        const store = await redisStore({
          url: process.env.REDIS_URL,
        });
        return {
          store,
        };
      },
    }),
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
    AuthModule,
    JwtModule,
    StaffModule,
    ShiftModule,
    RoomModule,
    BookingModule,
    StepModule,
    BuildingModule,
    FloorModule,
    PhysicalRoomModule,
    RoomBoundaryModule,
    ClinicModule,
    ClinicBoundaryModule,
    DoorModule,
    CategoryModule,
    PoiModule,
    NodeModule,
    EdgeModule,
    ConnectorModule,
    GraphModule,
    FeatureTemplateModule,
    PlacedFeatureModule,
    BlockageModule,
    TriageConfigModule,
    TransactionModule,
    InfermedicaModule,
    PatientModule,
    DoctorModule,
    NotificationModule,
    VnptModule,
    AccountModule,
    NavigationModule,
    FlowModule,
    SpecialtyModule,
    TemplateModule,
    QueueModule,
    VisitSessionModule,
    ClinicalDocumentModule,
  ],
})
export class AppModule {}
