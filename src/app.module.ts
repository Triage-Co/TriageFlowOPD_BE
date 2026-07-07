import { Module } from '@nestjs/common';
import { AuthModule } from './routes/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { SharedModule } from './shared/shared.module';
import { InfermedicaModule } from './routes/infermedica/infermedica.module';
import { PaymentModule } from './routes/payment/payment.module';
import { ScheduleModule } from '@nestjs/schedule';
import { BookingModule } from './routes/booking/booking.module';
import { SpecialtyModule } from './routes/specialty/specialty.module';
import { DoctorModule } from './routes/doctor/doctor.module';
import { ShiftModule } from './routes/shift/shift.module';
import { StepModule } from './routes/step/step.module';
import { FlowModule } from './routes/flow/flow.module';
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
import { GraphModule } from './routes/graph/graph.module';
import { FeatureTemplateModule } from './routes/feature-template/feature-template.module';
import { PlacedFeatureModule } from './routes/placed-feature/placed-feature.module';
import { BlockageModule } from './routes/blockage/blockage.module';

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
    FlowModule,
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
    GraphModule,
    FeatureTemplateModule,
    PlacedFeatureModule,
    BlockageModule,
  ],
})
export class AppModule {}
