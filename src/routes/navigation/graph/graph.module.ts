import { Module } from '@nestjs/common';
import { GraphController } from './graph.controller';
import { GraphGenerationService } from './graph.service';
import { SharedModule } from '../../../shared/shared.module';

@Module({
  imports: [SharedModule],
  controllers: [GraphController],
  providers: [GraphGenerationService],
  exports: [GraphGenerationService],
})
export class GraphModule {}
