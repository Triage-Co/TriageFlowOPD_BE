import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BoundaryType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  LineStringGeomDto,
  PointGeomDto,
  PolygonGeomDto,
} from './geojson.dto';

export class CreateRoomBatchItemDto {
  @IsString()
  @Length(1, 100)
  @ApiProperty({ example: 'tmp-room-1' })
  tempKey: string;

  @IsString()
  @Length(1, 50)
  @Matches(/^[A-Za-z0-9._-]+$/)
  @ApiProperty({ example: 'ROOM_101' })
  roomCode: string;

  @IsString()
  @Length(1, 255)
  @ApiProperty({ example: 'Phòng khám Nhi số 1' })
  roomLabel: string;

  @IsNumber()
  @IsOptional()
  @Min(0.5)
  @Max(20)
  @ApiPropertyOptional({ example: 3.2 })
  heightMeters?: number;

  @IsUUID()
  @IsOptional()
  @ApiPropertyOptional()
  areaId?: string;

  @ValidateNested()
  @Type(() => PolygonGeomDto)
  @ApiProperty({ type: PolygonGeomDto })
  outlineGeom: PolygonGeomDto;

  @ValidateNested()
  @Type(() => PointGeomDto)
  @ApiProperty({ type: PointGeomDto })
  centerGeom: PointGeomDto;
}

export class UpdateRoomBatchItemDto {
  @IsUUID()
  @ApiProperty()
  id: string;

  @IsString()
  @IsOptional()
  @Length(1, 50)
  @Matches(/^[A-Za-z0-9._-]+$/)
  @ApiPropertyOptional()
  roomCode?: string;

  @IsString()
  @IsOptional()
  @Length(1, 255)
  @ApiPropertyOptional()
  roomLabel?: string;

  @IsNumber()
  @IsOptional()
  @Min(0.5)
  @Max(20)
  @ApiPropertyOptional()
  heightMeters?: number;

  @IsUUID()
  @IsOptional()
  @ApiPropertyOptional()
  areaId?: string | null;

  @ValidateNested()
  @Type(() => PolygonGeomDto)
  @IsOptional()
  @ApiPropertyOptional({ type: PolygonGeomDto })
  outlineGeom?: PolygonGeomDto;

  @ValidateNested()
  @Type(() => PointGeomDto)
  @IsOptional()
  @ApiPropertyOptional({ type: PointGeomDto })
  centerGeom?: PointGeomDto;
}

export class RoomsBatchDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CreateRoomBatchItemDto)
  @ApiProperty({ type: [CreateRoomBatchItemDto] })
  create: CreateRoomBatchItemDto[];

  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => UpdateRoomBatchItemDto)
  @ApiProperty({ type: [UpdateRoomBatchItemDto] })
  update: UpdateRoomBatchItemDto[];

  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  @ApiProperty({ type: [String] })
  delete: string[];
}

export class CreateBoundaryBatchItemDto {
  @IsString()
  @Length(1, 100)
  @ApiProperty({ example: 'tmp-boundary-1' })
  tempKey: string;

  @IsUUID()
  @IsOptional()
  @ApiPropertyOptional()
  roomId?: string;

  @IsString()
  @IsOptional()
  @Length(1, 100)
  @ApiPropertyOptional({ example: 'tmp-room-1' })
  roomTempKey?: string;

  @IsInt()
  @Min(1)
  @ApiProperty({ example: 1 })
  seqNo: number;

  @IsEnum(BoundaryType)
  @ApiProperty({ enum: BoundaryType, example: BoundaryType.WALL })
  boundaryType: BoundaryType;

  @IsBoolean()
  @ApiProperty({ example: true })
  hasWall: boolean;

  @IsString()
  @IsOptional()
  @Length(0, 255)
  @ApiPropertyOptional()
  label?: string;

  @ValidateNested()
  @Type(() => LineStringGeomDto)
  @ApiProperty({ type: LineStringGeomDto })
  lineGeom: LineStringGeomDto;
}

export class UpdateBoundaryBatchItemDto {
  @IsUUID()
  @ApiProperty()
  id: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  @ApiPropertyOptional()
  seqNo?: number;

  @IsEnum(BoundaryType)
  @IsOptional()
  @ApiPropertyOptional({ enum: BoundaryType })
  boundaryType?: BoundaryType;

  @IsBoolean()
  @IsOptional()
  @ApiPropertyOptional()
  hasWall?: boolean;

  @IsString()
  @IsOptional()
  @Length(0, 255)
  @ApiPropertyOptional()
  label?: string;

  @ValidateNested()
  @Type(() => LineStringGeomDto)
  @IsOptional()
  @ApiPropertyOptional({ type: LineStringGeomDto })
  lineGeom?: LineStringGeomDto;
}

export class BoundariesBatchDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CreateBoundaryBatchItemDto)
  @ApiProperty({ type: [CreateBoundaryBatchItemDto] })
  create: CreateBoundaryBatchItemDto[];

  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => UpdateBoundaryBatchItemDto)
  @ApiProperty({ type: [UpdateBoundaryBatchItemDto] })
  update: UpdateBoundaryBatchItemDto[];

  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  @ApiProperty({ type: [String] })
  delete: string[];
}

export class MapEditorBatchDto {
  @ValidateNested()
  @Type(() => RoomsBatchDto)
  @ApiProperty({ type: RoomsBatchDto })
  rooms: RoomsBatchDto;

  @ValidateNested()
  @Type(() => BoundariesBatchDto)
  @ApiProperty({ type: BoundariesBatchDto })
  boundaries: BoundariesBatchDto;
}
