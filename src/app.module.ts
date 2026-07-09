import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SharedModule } from './shared/shared.module';
import { ScheduleModule } from '@nestjs/schedule';
import { BuildingModule } from './routes/building/building.module';
import { FloorModule } from './routes/floor/floor.module';
import { PhysicalRoomModule } from './routes/physical-room/physical-room.module';
import { RoomBoundaryModule } from './routes/room-boundary/room-boundary.module';
import { DoorModule } from './routes/door/door.module';
import { CategoryModule } from './routes/category/category.module';
import { PoiModule } from './routes/poi/poi.module';
import { NodeModule } from './routes/node/node.module';
import { EdgeModule } from './routes/edge/edge.module';
import { ConnectorModule } from './routes/connector/connector.module';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    SharedModule,
    BuildingModule,
    FloorModule,
    PhysicalRoomModule,
    RoomBoundaryModule,
    DoorModule,
    CategoryModule,
    PoiModule,
    NodeModule,
    EdgeModule,
    ConnectorModule,
    FeatureTemplateModule,
    PlacedFeatureModule,
    BlockageModule,
    AuthModule,
    ShiftModule,
    RoomModule,
    TriageConfigModule,
    TransactionModule,
    BookingModule,
    InfermedicaModule,
    PatientModule,
    DoctorModule,
    NotificationModule,
    VnptModule
  ],
})
export class AppModule {}
