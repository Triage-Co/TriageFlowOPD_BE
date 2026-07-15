import { ApiProperty } from '@nestjs/swagger';
import { RoomType, BoundaryType, NodeType } from '@prisma/client';

export class GeoJsonGeometryDto {
  @ApiProperty({ example: 'Point', description: 'Loại hình hình học (Point, Polygon, LineString...)' })
  type: string;

  @ApiProperty({
    example: [105.804817, 21.028511],
    description: 'Tọa độ hình học của thực thể',
  })
  coordinates: any;
}

export class PoiCategoryDetailDto {
  @ApiProperty({ example: 'Phòng khám', description: 'Tên danh mục' })
  name: string;

  @ApiProperty({ example: 'clinic-icon', description: 'Tên icon hiển thị' })
  icon: string;
}

export class MapPoiDto {
  @ApiProperty({ example: 'a6b32cb3-1a22-42da-91ef-f6089bd608d0' })
  id: string;

  @ApiProperty({ example: 'b7c43dc4-2b33-53eb-02fg-g7090ce709e1' })
  roomId: string;

  @ApiProperty({ example: 'c8d54ed5-3c44-64fc-13gh-h8101df810f2' })
  categoryId: string;

  @ApiProperty({ example: 'Phòng khám Nhi' })
  name: string;

  @ApiProperty({ example: 'Chuyên khoa nhi tổng quát' })
  description: string;

  @ApiProperty({ example: true })
  active: boolean;

  @ApiProperty({ type: PoiCategoryDetailDto })
  category: PoiCategoryDetailDto;
}

export class MapRoomBoundaryDto {
  @ApiProperty({ example: 'a6b32cb3-1a22-42da-91ef-f6089bd608d0' })
  id: string;

  @ApiProperty({ example: 'b7c43dc4-2b33-53eb-02fg-g7090ce709e1' })
  roomId: string;

  @ApiProperty({ example: 1, description: 'Số thứ tự của đoạn biên trong chuỗi ranh giới phòng' })
  seqNo: number;

  @ApiProperty({ type: GeoJsonGeometryDto, required: false, description: 'Hình học ranh giới đoạn tường (LineString)' })
  lineGeom?: GeoJsonGeometryDto;

  @ApiProperty({ enum: BoundaryType, example: BoundaryType.WALL })
  boundaryType: BoundaryType;

  @ApiProperty({ example: 'd8f65fe6-4e55-75gd-24ij-j9112eg911g3', required: false })
  adjacentRoomId?: string;

  @ApiProperty({ example: true })
  hasWall: boolean;

  @ApiProperty({ example: 'e9g76gf7-5f66-86he-35jk-k0223fh022h4', required: false })
  doorId?: string;
}

export class MapPhysicalRoomDto {
  @ApiProperty({ example: 'a6b32cb3-1a22-42da-91ef-f6089bd608d0' })
  id: string;

  @ApiProperty({ example: 'b7c43dc4-2b33-53eb-02fg-g7090ce709e1' })
  floorId: string;

  @ApiProperty({ example: 'CR-101' })
  roomCode: string;

  @ApiProperty({ example: 'Phòng Khám 101' })
  roomLabel: string;

  @ApiProperty({ enum: RoomType, example: RoomType.CONSULTATION })
  type: RoomType;

  @ApiProperty({ example: 3.2, required: false, description: 'Chiều cao phòng (mét)' })
  heightMeters?: number;

  @ApiProperty({ type: GeoJsonGeometryDto, required: false, description: 'Tọa độ điểm trung tâm phòng (Point)' })
  centerGeom?: GeoJsonGeometryDto;

  @ApiProperty({ type: GeoJsonGeometryDto, required: false, description: 'Tọa độ đa giác bao quanh phòng (Polygon)' })
  outlineGeom?: GeoJsonGeometryDto;

  @ApiProperty({ type: [MapRoomBoundaryDto] })
  boundaries: MapRoomBoundaryDto[];

  @ApiProperty({ type: [MapPoiDto] })
  pois: MapPoiDto[];
}

export class MapDoorDto {
  @ApiProperty({ example: 'a6b32cb3-1a22-42da-91ef-f6089bd608d0' })
  id: string;

  @ApiProperty({ example: 'b7c43dc4-2b33-53eb-02fg-g7090ce709e1' })
  floorId: string;

  @ApiProperty({ example: 'c8d54ed5-3c44-64fc-13gh-h8101df810f2', required: false })
  nodeId?: string;

  @ApiProperty({ example: 'd8f65fe6-4e55-75gd-24ij-j9112eg911g3', required: false })
  roomAId?: string;

  @ApiProperty({ example: 'e9g76gf7-5f66-86he-35jk-k0223fh022h4', required: false })
  roomBId?: string;

  @ApiProperty({ type: GeoJsonGeometryDto, required: false, description: 'Tọa độ vị trí cửa (Point)' })
  positionGeom?: GeoJsonGeometryDto;

  @ApiProperty({ example: true, description: 'Hỗ trợ xe lăn di chuyển qua' })
  isAccessible: boolean;

  @ApiProperty({ example: false, description: 'Là lối thoát hiểm khẩn cấp' })
  isEmergency: boolean;

  @ApiProperty({ example: true })
  active: boolean;
}

export class MapFloorDto {
  @ApiProperty({ example: 'a6b32cb3-1a22-42da-91ef-f6089bd608d0' })
  id: string;

  @ApiProperty({ example: 'b7c43dc4-2b33-53eb-02fg-g7090ce709e1' })
  buildingId: string;

  @ApiProperty({ example: 1 })
  floorNumber: number;

  @ApiProperty({ example: 'http://example.com/floor1.png', required: false })
  floorPlanImageUrl?: string;

  @ApiProperty({ example: 50.5, required: false })
  widthMeters?: number;

  @ApiProperty({ example: 30.2, required: false })
  heightMeters?: number;

  @ApiProperty({ example: 10.0, required: false, description: 'Tỉ lệ điểm ảnh trên mỗi mét' })
  scalePixelsPerMeter?: number;

  @ApiProperty({ type: GeoJsonGeometryDto, required: false, description: 'Hình học chu vi tầng (Polygon)' })
  outlineGeom?: GeoJsonGeometryDto;

  @ApiProperty({ type: [MapPhysicalRoomDto] })
  rooms: MapPhysicalRoomDto[];

  @ApiProperty({ type: [MapDoorDto] })
  doors: MapDoorDto[];
}

export class BuildingDetailDto {
  @ApiProperty({ example: 'a6b32cb3-1a22-42da-91ef-f6089bd608d0' })
  id: string;

  @ApiProperty({ example: 'Tòa Nhà Lâm Sàng A' })
  name: string;

  @ApiProperty({ example: 'Khu A - Bệnh viện Đa Khoa' })
  addressLabel: string;

  @ApiProperty({ example: 5 })
  totalFloors: number;

  @ApiProperty({ example: 'b7c43dc4-2b33-53eb-02fg-g7090ce709e1' })
  organizationId: string;
}

export class GetBuildingMapResponseDataDto {
  @ApiProperty({ type: BuildingDetailDto })
  building: BuildingDetailDto;

  @ApiProperty({ type: [MapFloorDto] })
  floors: MapFloorDto[];
}

export class GetBuildingMapResponseDto {
  @ApiProperty({ example: 200 })
  code: number;

  @ApiProperty({ example: 'Lấy dữ liệu bản đồ tòa nhà thành công' })
  message: string;

  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ type: GetBuildingMapResponseDataDto })
  data: GetBuildingMapResponseDataDto;
}

export class RoutePathNodeDto {
  @ApiProperty({ example: 'a6b32cb3-1a22-42da-91ef-f6089bd608d0' })
  id: string;

  @ApiProperty({ enum: NodeType, example: NodeType.CORRIDOR })
  type: NodeType;

  @ApiProperty({ example: [105.804817, 21.028511], description: 'Tọa độ [longitude, latitude]' })
  coords: number[];

  @ApiProperty({ example: { roomId: 'b7c43dc4-2b33-53eb-02fg-g7090ce709e1' }, required: false, description: 'Metadata phụ trợ' })
  metadata?: any;

  @ApiProperty({ example: 'c8d54ed5-3c44-64fc-13gh-h8101df810f2' })
  floorId: string;

  @ApiProperty({ example: 1 })
  floorNumber: number;
}

export class FindRouteResponseDataDto {
  @ApiProperty({ example: 21.72, description: 'Tổng quãng đường di chuyển thực tế (mét)' })
  totalDistance: number;

  @ApiProperty({ type: [RoutePathNodeDto], description: 'Danh sách các node đi qua theo thứ tự từ xuất phát đến đích' })
  path: RoutePathNodeDto[];
}

export class FindRouteResponseDto {
  @ApiProperty({ example: 200 })
  code: number;

  @ApiProperty({ example: 'Tìm đường đi thành công' })
  message: string;

  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ type: FindRouteResponseDataDto })
  data: FindRouteResponseDataDto;
}
