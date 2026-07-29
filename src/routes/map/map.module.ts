import { Module } from '@nestjs/common';
import { BuildingModule } from './building/building.module';
import { FloorModule } from './floor/floor.module';
import { PhysicalRoomModule } from './physical-room/physical-room.module';
import { AreaModule } from './area/area.module';
import { BoundaryModule } from './boundary/boundary.module';
import { DoorModule } from './door/door.module';
import { CategoryModule } from './category/category.module';
import { PoiModule } from './poi/poi.module';
import { FeatureTemplateModule } from './feature-template/feature-template.module';
import { PlacedFeatureModule } from './placed-feature/placed-feature.module';
import { MapEditorModule } from './map-editor/map-editor.module';

@Module({
  imports: [
    BuildingModule,
    FloorModule,
    PhysicalRoomModule,
    AreaModule,
    BoundaryModule,
    DoorModule,
    CategoryModule,
    PoiModule,
    FeatureTemplateModule,
    PlacedFeatureModule,
    MapEditorModule,
  ],
  exports: [
    BuildingModule,
    FloorModule,
    PhysicalRoomModule,
    AreaModule,
    BoundaryModule,
    DoorModule,
    CategoryModule,
    PoiModule,
    FeatureTemplateModule,
    PlacedFeatureModule,
    MapEditorModule,
  ],
})
export class MapModule {}
