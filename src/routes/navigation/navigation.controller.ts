import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NavigationService } from './navigation.service';
import { GetRouteDto } from './dto/get-route.dto';
import { GetBuildingMapResponseDto, FindRouteResponseDto } from './dto/navigation-response.dto';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';

@ApiTags('Navigation')
@Controller('navigation')
export class NavigationController {
  constructor(private readonly navigationService: NavigationService) {}

  @Get('building/:buildingId/map')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard)
  @ApiOperation({
    summary: 'Lấy toàn bộ dữ liệu bản đồ chi tiết của một tòa nhà',
    description: 'API này trả về thông tin chi tiết về không gian của toàn bộ tòa nhà, bao gồm danh sách các tầng (Floors kèm outlineGeom), danh sách phòng vật lý (PhysicalRooms kèm centerGeom & outlineGeom), các điểm POI trong phòng, các cạnh ranh giới phòng (RoomBoundaries) và các cửa ra vào (Doors kèm positionGeom). Kết quả được tự động cache trong Redis để tối ưu hiệu năng.',
  })
  @ApiParam({
    name: 'buildingId',
    description: 'ID của tòa nhà cần lấy dữ liệu bản đồ (dạng UUID)',
    example: 'a6b32cb3-1a22-42da-91ef-f6089bd608d0',
  })
  @ApiResponse({
    status: 200,
    type: GetBuildingMapResponseDto,
    description: 'Trả về dữ liệu bản đồ tòa nhà thành công dưới dạng cấu trúc GeoJSON lồng nhau.',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy tòa nhà với ID tương ứng.',
  })
  async getBuildingMap(@Param('buildingId') buildingId: string) {
    const data = await this.navigationService.getBuildingMap(buildingId);
    return {
      code: 200,
      message: 'Lấy dữ liệu bản đồ tòa nhà thành công',
      status: 'success',
      data,
    };
  }

  @Get('route')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard)
  @ApiOperation({
    summary: 'Tìm đường đi ngắn nhất giữa hai địa điểm (Room, POI, Node)',
    description: 'API sử dụng thuật toán A* để tính toán đường đi tối ưu trong không gian trong nhà (indoor navigation). Người dùng có thể tìm đường từ một Phòng (ROOM), điểm dịch vụ (POI) hoặc Node cụ thể trên bản đồ đến một điểm đích khác. Hệ thống tự động tính toán khoảng cách thực tế giữa các node hành lang, cửa, phòng và tích hợp cả cầu nối thang bộ/thang máy liên tầng.',
  })
  @ApiResponse({
    status: 200,
    type: FindRouteResponseDto,
    description: 'Trả về thông tin đường đi tối ưu bao gồm tổng quãng đường di chuyển (mét) và mảng danh sách các Node đi qua.',
  })
  @ApiResponse({
    status: 400,
    description: 'Yêu cầu không hợp lệ hoặc không tìm thấy đường đi do đồ thị bị ngắt kết nối.',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy địa điểm xuất phát, địa điểm đích hoặc Node tương ứng trong hệ thống.',
  })
  async findRoute(@Query() query: GetRouteDto) {
    const data = await this.navigationService.findRoute(query);
    return {
      code: 200,
      message: 'Tìm đường đi thành công',
      status: 'success',
      data,
    };
  }
}
