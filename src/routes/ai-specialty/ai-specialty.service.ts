import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/config/prisma.service';
import {
  CreateAiSpecialtyDto,
  CreateAiSpecialtyMappingDto,
  QueryAiSpecialtyDto,
  UpdateAiSpecialtyDto,
  UpdateAiSpecialtyMappingDto,
} from './dto/ai-specialty.dto';
import { normalizeAiCode, selectNextPrimary } from './ai-specialty.util';

const mappingInclude = {
  specialty: {
    select: {
      specialty_id: true,
      specialty_code: true,
      specialty_name: true,
      is_active: true,
    },
  },
} as const;

@Injectable()
export class AiSpecialtyService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryAiSpecialtyDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 50;
    const skip = (page - 1) * limit;

    const where: Prisma.AiSpecialtyWhereInput = {};
    if (query.is_active !== undefined) {
      where.is_active = query.is_active;
    }
    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { ai_code: { contains: q, mode: 'insensitive' } },
        { ai_name: { contains: q, mode: 'insensitive' } },
        { ai_name_vi: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.aiSpecialty.findMany({
        where,
        skip,
        take: limit,
        orderBy: { ai_code: 'asc' },
        include: {
          mappings: {
            where: { is_active: true },
            include: mappingInclude,
            orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }],
          },
        },
      }),
      this.prisma.aiSpecialty.count({ where }),
    ]);

    return {
      code: 200,
      message: 'Lấy thông tin thành công',
      status: 'success',
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findOne(id: string) {
    const data = await this.prisma.aiSpecialty.findUnique({
      where: { ai_specialty_id: id },
      include: {
        mappings: {
          include: mappingInclude,
          orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }],
        },
      },
    });
    if (!data) {
      throw new NotFoundException(`Không tìm thấy AI specialty với ID: ${id}`);
    }
    return {
      code: 200,
      message: 'Thành công',
      status: 'success',
      data,
    };
  }

  async create(dto: CreateAiSpecialtyDto) {
    const ai_code = normalizeAiCode(dto.ai_code);
    const existing = await this.prisma.aiSpecialty.findUnique({
      where: { ai_code },
    });
    if (existing) {
      throw new ConflictException({
        message: 'Mã AI specialty đã tồn tại',
        detail: `ai_code=${ai_code}`,
      });
    }

    const data = await this.prisma.aiSpecialty.create({
      data: {
        ai_code,
        ai_name: dto.ai_name,
        ai_name_vi: dto.ai_name_vi,
        description: dto.description,
      },
    });

    return {
      code: 201,
      message: 'Tạo AI specialty thành công',
      status: 'success',
      data,
    };
  }

  async update(id: string, dto: UpdateAiSpecialtyDto) {
    const existing = await this.prisma.aiSpecialty.findUnique({
      where: { ai_specialty_id: id },
    });
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy AI specialty với ID: ${id}`);
    }

    const ai_code = dto.ai_code ? normalizeAiCode(dto.ai_code) : undefined;
    if (ai_code && ai_code !== existing.ai_code) {
      const duplicate = await this.prisma.aiSpecialty.findUnique({
        where: { ai_code },
      });
      if (duplicate) {
        throw new ConflictException({
          message: 'Mã AI specialty đã tồn tại',
          detail: `ai_code=${ai_code}`,
        });
      }
    }

    const data = await this.prisma.aiSpecialty.update({
      where: { ai_specialty_id: id },
      data: {
        ...(ai_code && { ai_code }),
        ...(dto.ai_name !== undefined && { ai_name: dto.ai_name }),
        ...(dto.ai_name_vi !== undefined && { ai_name_vi: dto.ai_name_vi }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active }),
      },
    });

    return {
      code: 200,
      message: 'Cập nhật AI specialty thành công',
      status: 'success',
      data,
    };
  }

  async remove(id: string) {
    const existing = await this.prisma.aiSpecialty.findUnique({
      where: { ai_specialty_id: id },
      include: {
        _count: {
          select: { mappings: { where: { is_active: true } } },
        },
      },
    });
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy AI specialty với ID: ${id}`);
    }
    if (existing._count.mappings > 0) {
      throw new ConflictException({
        message: 'Không thể vô hiệu hóa AI specialty vì còn mapping active',
        detail: `active_mappings=${existing._count.mappings}`,
      });
    }

    const data = await this.prisma.aiSpecialty.update({
      where: { ai_specialty_id: id },
      data: { is_active: false },
    });

    return {
      code: 200,
      message: 'Đã vô hiệu hóa AI specialty',
      status: 'success',
      data,
    };
  }

  async findMappings(aiSpecialtyId: string) {
    await this.requireAiSpecialty(aiSpecialtyId);
    const data = await this.prisma.aiSpecialtyMapping.findMany({
      where: { ai_specialty_id: aiSpecialtyId },
      include: mappingInclude,
      orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }],
    });
    return {
      code: 200,
      message: 'Thành công',
      status: 'success',
      data,
    };
  }

  async createMapping(aiSpecialtyId: string, dto: CreateAiSpecialtyMappingDto) {
    const aiSpecialty = await this.requireAiSpecialty(aiSpecialtyId);
    if (!aiSpecialty.is_active) {
      throw new ConflictException({
        message: 'Không thể tạo mapping cho AI specialty đã vô hiệu hóa',
        detail: `ai_specialty_id=${aiSpecialtyId}`,
      });
    }

    const specialty = await this.prisma.specialty.findUnique({
      where: { specialty_id: dto.specialty_id },
    });
    if (!specialty) {
      throw new NotFoundException(
        `Không tìm thấy chuyên khoa với ID: ${dto.specialty_id}`,
      );
    }
    if (!specialty.is_active) {
      throw new BadRequestException({
        message: 'Không thể map tới chuyên khoa đã vô hiệu hóa',
        detail: `specialty_id=${dto.specialty_id}`,
      });
    }

    const duplicate = await this.prisma.aiSpecialtyMapping.findUnique({
      where: {
        ai_specialty_id_specialty_id: {
          ai_specialty_id: aiSpecialtyId,
          specialty_id: dto.specialty_id,
        },
      },
    });
    if (duplicate) {
      throw new ConflictException({
        message: 'Mapping đã tồn tại',
        detail: `ai_specialty_id=${aiSpecialtyId}, specialty_id=${dto.specialty_id}`,
      });
    }

    const data = await this.prisma.$transaction(async (tx) => {
      const created = await tx.aiSpecialtyMapping.create({
        data: {
          ai_specialty_id: aiSpecialtyId,
          specialty_id: dto.specialty_id,
          is_primary: false,
          sort_order: dto.sort_order ?? 0,
        },
        include: mappingInclude,
      });

      if (dto.is_primary) {
        await this.setPrimaryInTx(tx, aiSpecialtyId, created.mapping_id);
      } else {
        await this.ensurePrimaryInTx(tx, aiSpecialtyId);
      }

      return tx.aiSpecialtyMapping.findUniqueOrThrow({
        where: { mapping_id: created.mapping_id },
        include: mappingInclude,
      });
    });

    return {
      code: 201,
      message: 'Tạo mapping thành công',
      status: 'success',
      data,
    };
  }

  async updateMapping(
    aiSpecialtyId: string,
    mappingId: string,
    dto: UpdateAiSpecialtyMappingDto,
  ) {
    const mapping = await this.requireMapping(aiSpecialtyId, mappingId);

    if (dto.specialty_id && dto.specialty_id !== mapping.specialty_id) {
      const specialty = await this.prisma.specialty.findUnique({
        where: { specialty_id: dto.specialty_id },
      });
      if (!specialty) {
        throw new NotFoundException(
          `Không tìm thấy chuyên khoa với ID: ${dto.specialty_id}`,
        );
      }
      if (!specialty.is_active) {
        throw new BadRequestException({
          message: 'Không thể map tới chuyên khoa đã vô hiệu hóa',
          detail: `specialty_id=${dto.specialty_id}`,
        });
      }
      const duplicate = await this.prisma.aiSpecialtyMapping.findUnique({
        where: {
          ai_specialty_id_specialty_id: {
            ai_specialty_id: aiSpecialtyId,
            specialty_id: dto.specialty_id,
          },
        },
      });
      if (duplicate) {
        throw new ConflictException({
          message: 'Mapping đã tồn tại',
          detail: `ai_specialty_id=${aiSpecialtyId}, specialty_id=${dto.specialty_id}`,
        });
      }
    }

    const data = await this.prisma.$transaction(async (tx) => {
      await tx.aiSpecialtyMapping.update({
        where: { mapping_id: mappingId },
        data: {
          ...(dto.specialty_id && { specialty_id: dto.specialty_id }),
          ...(dto.sort_order !== undefined && { sort_order: dto.sort_order }),
          ...(dto.is_active !== undefined && { is_active: dto.is_active }),
          ...(dto.is_primary === false && { is_primary: false }),
        },
      });

      if (dto.is_primary === true) {
        await this.setPrimaryInTx(tx, aiSpecialtyId, mappingId);
      } else {
        await this.ensurePrimaryInTx(tx, aiSpecialtyId);
      }

      return tx.aiSpecialtyMapping.findUniqueOrThrow({
        where: { mapping_id: mappingId },
        include: mappingInclude,
      });
    });

    return {
      code: 200,
      message: 'Cập nhật mapping thành công',
      status: 'success',
      data,
    };
  }

  async removeMapping(aiSpecialtyId: string, mappingId: string) {
    await this.requireMapping(aiSpecialtyId, mappingId);

    const data = await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.aiSpecialtyMapping.delete({
        where: { mapping_id: mappingId },
        include: mappingInclude,
      });
      await this.ensurePrimaryInTx(tx, aiSpecialtyId);
      return deleted;
    });

    return {
      code: 200,
      message: 'Đã xóa mapping',
      status: 'success',
      data,
    };
  }

  /**
   * Resolve Infermedica specialist id (sp_12) to the hospital Specialty used by
   * Room / Staff / Queue / Booking. Prefers the primary mapping; falls back to
   * Specialty.specialty_code so existing kiosk/doctor flows keep working.
   */
  async resolveHospitalSpecialtyByAiCode(aiCode: string) {
    const normalized = normalizeAiCode(aiCode);

    const aiSpecialty = await this.prisma.aiSpecialty.findFirst({
      where: {
        ai_code: normalized,
        is_active: true,
      },
      include: {
        mappings: {
          where: {
            is_active: true,
            specialty: { is_active: true },
          },
          include: { specialty: true },
          orderBy: [
            { is_primary: 'desc' },
            { sort_order: 'asc' },
            { createdAt: 'asc' },
          ],
        },
      },
    });

    const mapped = selectNextPrimary(aiSpecialty?.mappings ?? []);
    if (mapped?.specialty) {
      return mapped.specialty;
    }

    return this.prisma.specialty.findFirst({
      where: {
        is_active: true,
        specialty_code: { equals: aiCode.trim(), mode: 'insensitive' },
      },
    });
  }

  private async requireAiSpecialty(id: string) {
    const existing = await this.prisma.aiSpecialty.findUnique({
      where: { ai_specialty_id: id },
    });
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy AI specialty với ID: ${id}`);
    }
    return existing;
  }

  private async requireMapping(aiSpecialtyId: string, mappingId: string) {
    await this.requireAiSpecialty(aiSpecialtyId);
    const mapping = await this.prisma.aiSpecialtyMapping.findFirst({
      where: {
        mapping_id: mappingId,
        ai_specialty_id: aiSpecialtyId,
      },
    });
    if (!mapping) {
      throw new NotFoundException(
        `Không tìm thấy mapping với ID: ${mappingId}`,
      );
    }
    return mapping;
  }

  private async setPrimaryInTx(
    tx: Prisma.TransactionClient,
    aiSpecialtyId: string,
    mappingId: string,
  ) {
    await tx.aiSpecialtyMapping.updateMany({
      where: { ai_specialty_id: aiSpecialtyId, is_primary: true },
      data: { is_primary: false },
    });
    await tx.aiSpecialtyMapping.update({
      where: { mapping_id: mappingId },
      data: { is_primary: true, is_active: true },
    });
  }

  private async ensurePrimaryInTx(
    tx: Prisma.TransactionClient,
    aiSpecialtyId: string,
  ) {
    const mappings = await tx.aiSpecialtyMapping.findMany({
      where: { ai_specialty_id: aiSpecialtyId },
    });
    const next = selectNextPrimary(mappings);
    if (!next) {
      return;
    }
    if (next.is_primary) {
      return;
    }
    await this.setPrimaryInTx(tx, aiSpecialtyId, next.mapping_id);
  }
}
