import { Module } from '@nestjs/common';
import { NavigationCoreModule } from './core/navigation-core.module';
import { NodeModule } from './node/node.module';
import { EdgeModule } from './edge/edge.module';
import { ConnectorModule } from './connector/connector.module';
import { BlockageModule } from './blockage/blockage.module';
import { GraphModule } from './graph/graph.module';

@Module({
  imports: [
    NavigationCoreModule,
    NodeModule,
    EdgeModule,
    ConnectorModule,
    BlockageModule,
    GraphModule,
  ],
  exports: [
    NavigationCoreModule,
    NodeModule,
    EdgeModule,
    ConnectorModule,
    BlockageModule,
    GraphModule,
  ],
})
export class NavigationModule {}
