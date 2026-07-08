import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTriageConfigDto } from './dto/create-triage_config.dto';
import { UpdateTriageConfigDto } from './dto/update-triage_config.dto';
import { PrismaService } from '../../shared/config/prisma.service';

@Injectable()
export class TriageConfigService {
  constructor(private readonly prismaService: PrismaService) { }
  async create(createTriageConfigDto: CreateTriageConfigDto) {
    try {
      const data = await this.prismaService.triage_Config.create({
        data: {
          rule_key: createTriageConfigDto.rule_key,
          rule_value: createTriageConfigDto.rule_value
        }
      })

      return {
        code: 200,
        status: "success",
        message: "Config thành công",
        data: data
      }
    } catch (error) {
      throw error
    }
  }

  async findAll() {
    const data = await this.prismaService.triage_Config.findMany();
    if (!data) {
      throw new NotFoundException("Danh sách rỗng")
    }
    return {
      code: 200,
      status: "success",
      message: "Lấy danh sách thành công",
      data: data
    }
  }


}
