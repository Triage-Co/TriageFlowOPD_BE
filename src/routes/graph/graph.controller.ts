import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { GraphGenerationService } from './graph.service';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { IsRoleGuard } from '../../shared/guards/is-role.guard';
import { roles } from '../../shared/decorator/role.decorator';
import { RoleTypeEnum } from '@prisma/client';
import { IsArray, IsNumber, IsOptional } from 'class-validator';

export class LinkConnectorDto {
  @ApiProperty({
    description: 'Optional [longitude, latitude] coordinates of the connector for matching nearest nodes',
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

  @Post(':floorId/generate')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @roles(RoleTypeEnum.ADMIN)
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiOperation({ summary: 'Auto-generate navigation graph for a floor (Admin)' })
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
  @ApiOperation({ summary: 'Get navigation graph (nodes and edges) for a floor' })
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
  @ApiOperation({ summary: 'Link inter-floor connector nodes across served floors (Admin)' })
  async link(
    @Param('connectorId') connectorId: string,
    @Body() body: LinkConnectorDto,
  ) {
    const data = await this.graphService.linkConnector(connectorId, body.coords);
    return {
      code: 200,
      message: 'Linked connector successfully',
      status: 'success',
      data,
    };
  }
}
