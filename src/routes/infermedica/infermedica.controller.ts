import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { RoleTypeEnum } from '@prisma/client';
import { roles } from '../../shared/decorator/role.decorator';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { IsRoleGuard } from '../../shared/guards/is-role.guard';
import { InfermedicaService } from './infermedica.service';
import { TriageDto, ParseDto, SearchDto } from './dto/infermedica.dto';
import { UpdateQuestionLimitDto } from './dto/triage-config.dto';

@Controller('infermedica')
export class InfermedicaController {
  constructor(private readonly infermedicaService: InfermedicaService) {}

  @Post('/parse')
  @ApiOperation({
    summary: 'Hỏi triệu chứng với AI',
  })
  @ApiOkResponse({
    schema: {
      example: {
        code: 200,
        message: 'Trả kết quả thành công',
        status: 'success',
        data: {
          mentions: [
            {
              id: 'p_8',
              name: 'Diagnosed diabetes',
              common_name: 'Diagnosed diabetes',
              orth: 'diabetes',
              type: 'risk_factor',
              choice_id: 'present',
            },
            {
              id: 's_554',
              name: 'Pain in upper limb, hand or fingers',
              common_name: 'Pain in hand or fingers',
              orth: 'pain in hand',
              type: 'symptom',
              choice_id: 'present',
            },
          ],
          obvious: true,
        },
      },
    },
  })
  parse(@Body() parseDto: ParseDto) {
    return this.infermedicaService.parse(parseDto);
  }

  @ApiOperation({
    summary: 'Hỏi bệnh (có thể lập đi lập lại)',
  })
  @ApiOkResponse({
    schema: {
      example: {
        question: {
          type: 'group_single',
          text: 'Which type of diabetes have you been diagnosed with?',
          extras: {},
          items: [
            {
              id: 'p_370',
              name: 'Diabetes mellitus type 1',
              choices: [
                {
                  id: 'present',
                  label: 'Yes',
                },
                {
                  id: 'absent',
                  label: 'No',
                },
                {
                  id: 'unknown',
                  label: "Don't know",
                },
              ],
            },
            {
              id: 'p_371',
              name: 'Diabetes mellitus type 2',
              choices: [
                {
                  id: 'present',
                  label: 'Yes',
                },
                {
                  id: 'absent',
                  label: 'No',
                },
                {
                  id: 'unknown',
                  label: "Don't know",
                },
              ],
            },
            {
              id: 'p_378',
              name: 'Other type of diabetes',
              choices: [
                {
                  id: 'present',
                  label: 'Yes',
                },
                {
                  id: 'absent',
                  label: 'No',
                },
                {
                  id: 'unknown',
                  label: "Don't know",
                },
              ],
            },
            {
              id: 'p_379',
              name: "Don't know",
              choices: [
                {
                  id: 'present',
                  label: 'Yes',
                },
                {
                  id: 'absent',
                  label: 'No',
                },
                {
                  id: 'unknown',
                  label: "Don't know",
                },
              ],
            },
          ],
        },
        conditions: [
          {
            id: 'c_634',
            name: 'Diabetic ketoacidosis',
            common_name: 'Diabetic ketoacidosis',
            probability: 0.3046,
          },
          {
            id: 'c_1580',
            name: 'Upper limb pain, unspecified',
            common_name: 'Unspecified upper limb pain',
            probability: 0.1528,
          },
          {
            id: 'c_209',
            name: "Raynaud's disease",
            common_name: 'Raynaud disease',
            probability: 0.0309,
          },
          {
            id: 'c_212',
            name: 'Carpal tunnel syndrome',
            common_name: 'Carpal tunnel syndrome',
            probability: 0.0309,
          },
          {
            id: 'c_948',
            name: 'Shoulder impingement syndrome',
            common_name: 'Shoulder impingement syndrome',
            probability: 0.0262,
          },
        ],
        extras: {},
        has_emergency_evidence: false,
        interview_token:
          'eyJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJQYXRpZW50RWR1Y2F0aW9uUmV2aXNpb25zIiwidG9rZW5QYXlsb2FkIjp7ImFnZUJ1bmRsZSI6ImFkdWx0IiwicGF0aWVudEVkdWNhdGlvblJldmlzaW9ucyI6e319LCJpYXQiOjE3ODE0NDcyMTN9.2-CUtL5YHGCdD9FsyW9j4TsNjfIaKEwulTYfG4Bybqc',
      },
    },
  })
  @Post('/diagnoise')
  @ApiQuery({
    name: 'citizen_id',
    required: true,
    description: 'Nhập CCCD/CMND',
    type: 'string',
    schema: {
      pattern: '^[0-9]{9}$|^[0-9]{12}$',
      example: '079099123456',
    },
  })
  @ApiQuery({
    name: 'interview_token',
    required: false,
    description: 'Nhập từ câu hỏi số 2',
    type: 'string',
  })
  diagnoise(
    @Body() triageDto: TriageDto,
    @Query('citizen_id') citizen_id: string,
    @Query('interview_token') interview_token?: string,
  ) {
    return this.infermedicaService.diagnosis(
      triageDto,
      citizen_id,
      interview_token,
    );
  }

  @ApiOperation({
    summary: 'Đề xuất (cần đi khám, tự chăm sóc hay cấp cứu...)',
  })
  @ApiOkResponse({
    schema: {
      example: {
        triage_level: 'emergency',
        serious: [
          {
            id: 's_3055',
            name: 'Current blood glucose level, more than 350 mg/dl or 19.4 mmol/l',
            common_name: 'Current blood sugar, over 350 mg/dl or 19.4 mmol/l',
            seriousness: 'serious',
            is_emergency: false,
          },
          {
            id: 's_3056',
            name: 'Blood glucose level in the last 6 hours, more than 250 mg/dl or 13.9 mmol/l',
            common_name:
              'Blood sugar level remaining over 250 mg/dl or 13.9 mmol/l for the past 6 hours',
            seriousness: 'serious',
            is_emergency: false,
          },
        ],
        root_cause: 'emergency_condition_likely',
        teleconsultation_applicable: false,
      },
    },
  })
  @Post('/triage')
  triage(@Body() triageDto: TriageDto) {
    return this.infermedicaService.triage(triageDto);
  }

  @ApiOperation({
    summary: 'Đề xuất khoa khám bệnh',
  })
  @ApiOkResponse({
    schema: {
      example: {
        recommended_specialist: {
          id: 'sp_22',
          name: 'Diabetologist',
        },
        recommended_channel: 'personal_visit',
      },
    },
  })
  @Post('/recommend_specialist')
  recommendSpecialist(
    @Body() triageDto: TriageDto,
    @Query('interview_token') interview_token: string,
  ) {
    return this.infermedicaService.recommendSpecialist(
      triageDto,
      interview_token,
    );
  }

  @Get('/search')
  @ApiOperation({
    summary: 'Tìm kiếm theo bộ phận',
  })
  @ApiOkResponse({
    schema: {
      example: [
        {
          id: 's_1982',
          label: 'hand rash',
        },
        {
          id: 's_554',
          label: 'hand hurt',
        },
        {
          id: 's_87',
          label: 'hands shake',
        },
        {
          id: 's_2091',
          label: 'hands hurt',
        },
        {
          id: 's_1426',
          label: 'hand cramps',
        },
        {
          id: 's_345',
          label: 'handwriting',
        },
        {
          id: 's_1449',
          label: 'hand feels stiff',
        },
        {
          id: 's_556',
          label: 'cold hands',
        },
      ],
    },
  })
  search(@Query() searchDto: SearchDto) {
    return this.infermedicaService.search(searchDto);
  }

  @Get('/question-limit')
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @roles(RoleTypeEnum.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[ADMIN] Lấy số câu hỏi tối đa của phiên triage' })
  getQuestionLimit() {
    return this.infermedicaService.getQuestionLimit();
  }

  @Patch('/question-limit')
  @UseGuards(IsAuthGuard, IsRoleGuard)
  @roles(RoleTypeEnum.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[ADMIN] Cập nhật số câu hỏi tối đa của phiên triage',
  })
  updateQuestionLimit(@Body() dto: UpdateQuestionLimitDto) {
    return this.infermedicaService.updateQuestionLimit(dto);
  }
}
