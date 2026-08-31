import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { GraphGenerationService } from './graph.service';
import { IsAuthGuard } from '../../../shared/guards/is-auth.guard';
import { IsRoleGuard } from '../../../shared/guards/is-role.guard';
import { roles } from '../../../shared/decorator/role.decorator';
import { RoleTypeEnum } from '@prisma/client';
import { IsArray, IsNumber, IsOptional, IsUUID } from 'class-validator';

export class CreateCorridorNodeDto {
  @ApiProperty({
    description: 'Longitude and latitude coordinates for the corridor node',
    type: [Number],
    example: [105.8049, 21.0285],
  })
  @IsArray()
  @IsNumber({}, { each: true })
  coords: number[];
}

export class CorridorEditsDto {
  @ApiProperty({
    description: 'Corridor node coordinates to add as [lng, lat] pairs',
    type: 'array',
    required: false,
    example: [[0.00012, 0.00034]],
  })
  @IsOptional()
  @IsArray()
  add?: number[][];

  @ApiProperty({
    description: 'Corridor or junction node IDs to remove',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  remove?: string[];
}

export class EdgeEditsDto {
  @ApiProperty({
    description:
      'Edge IDs to remove. Reverse-direction siblings on the same floor are also deleted.',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  remove: string[];
}

export class LinkConnectorDto {
  @ApiProperty({
    description:
      'Optional [longitude, latitude] coordinates of the connector for matching nearest nodes',
    required: false,
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  coords?: number[];
}

@ApiTags('Graph')
@Controller('graph')
export class GraphController {
  constructor(private readonly graphService: GraphGenerationService) {}

  @Post(':floorId/corridor-edits')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @roles(RoleTypeEnum.ADMIN)
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiOperation({
    summary:
      'Apply batched corridor/junction node add/remove without rebuilding edges (Admin)',
  })
  async applyCorridorEdits(
    @Param('floorId') floorId: string,
    @Body() body: CorridorEditsDto,
  ) {
    const data = await this.graphService.applyCorridorEdits(floorId, body);
    return {
      code: 200,
      message: 'Applied corridor edits successfully',
      status: 'success',
      data,
    };
  }

  @Post(':floorId/edge-edits')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @roles(RoleTypeEnum.ADMIN)
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiOperation({
    summary:
      'Delete navigation edges on a floor (both directions). Does not rebuild the graph (Admin)',
  })
  async applyEdgeEdits(
    @Param('floorId') floorId: string,
    @Body() body: EdgeEditsDto,
  ) {
    const data = await this.graphService.applyEdgeEdits(floorId, body);
    return {
      code: 200,
      message: 'Applied edge edits successfully',
      status: 'success',
      data,
    };
  }

  @Post(':floorId/corridor')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @roles(RoleTypeEnum.ADMIN)
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiOperation({ summary: 'Create a manual corridor node on a floor (Admin)' })
  async createCorridorNode(
    @Param('floorId') floorId: string,
    @Body() body: CreateCorridorNodeDto,
  ) {
    const data = await this.graphService.createCorridorNode(
      floorId,
      body.coords as [number, number],
    );
    return {
      code: 201,
      message: 'Created corridor node successfully',
      status: 'success',
      data,
    };
  }

  @Delete(':floorId/nodes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear all nodes for a floor (Debug)' })
  async clearNodes(@Param('floorId') floorId: string) {
    const data = await this.graphService.clearAllNodes(floorId);
    return { code: 200, message: 'Cleared all nodes', status: 'success', data };
  }

  @Post(':floorId/generate/doors')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate door nodes only (Debug)' })
  async generateDoors(@Param('floorId') floorId: string) {
    const data = await this.graphService.generateDoorsPhase(floorId);
    return {
      code: 200,
      message: 'Generated door nodes',
      status: 'success',
      data,
    };
  }

  @Post(':floorId/generate/corridors')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate corridor nodes only (Debug)' })
  async generateCorridors(@Param('floorId') floorId: string) {
    const data = await this.graphService.generateCorridorsPhase(floorId);
    return {
      code: 200,
      message: 'Generated corridor nodes',
      status: 'success',
      data,
    };
  }

  @Post(':floorId/generate/edges')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate graph edges (Debug)' })
  async generateEdges(@Param('floorId') floorId: string) {
    const data = await this.graphService.generateEdgesPhase(floorId);
    return { code: 200, message: 'Generated edges', status: 'success', data };
  }

  @Get(':floorId/debug-steps')
  @ApiOperation({
    summary: 'Get MPRSS algorithm debug steps geometry layers (Debug)',
  })
  async getDebugSteps(@Param('floorId') floorId: string) {
    const data = await this.graphService.getCorridorDebugSteps(floorId);
    return {
      code: 200,
      message: 'Retrieved debug steps successfully',
      status: 'success',
      data,
    };
  }

  @Post(':floorId/rebuild-edges')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @roles(RoleTypeEnum.ADMIN)
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiOperation({
    summary:
      'Rebuild navigation edges from existing nodes without regenerating nodes (Admin)',
  })
  async rebuildEdges(@Param('floorId') floorId: string) {
    const data = await this.graphService.rebuildEdgesForFloor(floorId);
    return {
      code: 200,
      message: 'Rebuilt graph edges from existing nodes',
      status: 'success',
      data,
    };
  }

  @Post(':floorId/generate')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @roles(RoleTypeEnum.ADMIN)
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiOperation({
    summary: 'Auto-generate navigation graph for a floor (Admin)',
  })
  async generate(@Param('floorId') floorId: string) {
    const data = await this.graphService.generateGraph(floorId);
    return {
      code: 200,
      message: 'Generated navigation graph successfully',
      status: 'success',
      data,
    };
  }

  @Get(':floorId')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard)
  @ApiOperation({
    summary: 'Get navigation graph (nodes and edges) for a floor',
  })
  async findOne(@Param('floorId') floorId: string) {
    const data = await this.graphService.getGraph(floorId);
    return {
      code: 200,
      message: 'Retrieved navigation graph successfully',
      status: 'success',
      data,
    };
  }

  @Post('connector/:connectorId/link')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @roles(RoleTypeEnum.ADMIN)
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiOperation({
    summary: 'Link inter-floor connector nodes across served floors (Admin)',
  })
  async link(
    @Param('connectorId') connectorId: string,
    @Body() body: LinkConnectorDto,
  ) {
    const data = await this.graphService.linkConnector(
      connectorId,
      body.coords,
    );
    return {
      code: 200,
      message: 'Linked connector successfully',
      status: 'success',
      data,
    };
  }
}
