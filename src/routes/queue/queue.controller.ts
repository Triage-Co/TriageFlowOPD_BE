import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { QueueService } from './queue.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { CallPatientDto } from './dto/create-queue.dto';
@ApiTags('Queue')
@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Post('call-next')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bác sĩ gọi bệnh nhân tiếp theo vào phòng khám' })
  @ApiBody({
    type: CallPatientDto,
    description: 'Thông tin bước khám (step), phòng khám và bác sĩ gọi',
    examples: {
      example1: {
        summary: 'Ví dụ request body',
        value: {
          step_id: 'a1b2c3d4-e5f6-7890-abcd-ef0123456789',
          room_id: 'b2c3d4e5-f6a7-8901-bcde-f0123456789a',
          staff_id: 'c3d4e5f6-a7b8-9012-cdef-0123456789ab',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Gọi bệnh nhân thành công và phát sóng realtime xuống TV.',
  })
  async callNextPatient(@Body() body: CallPatientDto) {
    const { step_id, room_id, staff_id } = body;
    return await this.queueService.callNextPatient(step_id, room_id, staff_id);
  }
}
