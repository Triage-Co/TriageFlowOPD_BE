import { Module } from '@nestjs/common';
import { MapEditorController } from './map-editor.controller';
import { MapEditorService } from './map-editor.service';

@Module({
  controllers: [MapEditorController],
  providers: [MapEditorService],
  exports: [MapEditorService],
})
export class MapEditorModule {}
