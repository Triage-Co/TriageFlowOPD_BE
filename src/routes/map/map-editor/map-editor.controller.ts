import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleTypeEnum } from '@prisma/client';
import { roles } from '../../../shared/decorator/role.decorator';
import { IsAuthGuard } from '../../../shared/guards/is-auth.guard';
import { IsRoleGuard } from '../../../shared/guards/is-role.guard';
import { MapEditorBatchDto } from './dto/batch-map-editor.dto';
import { MapEditorService } from './map-editor.service';

@ApiTags('MapEditor')
@Controller('map-editor')
export class MapEditorController {
  constructor(private readonly mapEditorService: MapEditorService) {}

  @Post('floor/:floorId/batch')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @roles(RoleTypeEnum.ADMIN)
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @ApiOperation({
    summary:
      'Batch create/update/delete rooms and boundaries for a floor (Admin)',
  })
  async applyBatch(
    @Param('floorId') floorId: string,
    @Body() body: MapEditorBatchDto,
  ) {
    const data = await this.mapEditorService.applyBatch(floorId, body);
    return {
      code: 200,
      message: 'Lưu bản đồ thành công',
      status: 'success',
      data,
    };
  }
}
