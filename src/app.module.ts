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
import { GraphModule } from './routes/graph/graph.module';
import { FeatureTemplateModule } from './routes/feature-template/feature-template.module';
import { PlacedFeatureModule } from './routes/placed-feature/placed-feature.module';
import { BlockageModule } from './routes/blockage/blockage.module';
import { AuthModule } from './routes/auth/auth.module';

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
    GraphModule,
    FeatureTemplateModule,
    PlacedFeatureModule,
    BlockageModule,
    AuthModule,
  ],
})
export class AppModule {}
