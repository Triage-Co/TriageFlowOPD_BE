import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ClinicalRoomType,
  DisplayScreenKind,
  DisplayScreenStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../shared/config/prisma.service';
import { DISPLAY_PIN_TOKEN_TYPE } from '../../shared/guards/is-display-pin.guard';
import { hashDisplayPin, verifyDisplayPin } from './display-pin.util';
import {
  ChangeDisplayPinDto,
  CreateDisplayScreenDto,
  FindOrCreateClinicDisplayDto,
  FindOrCreatePaymentDisplayDto,
  QueryDisplayScreenDto,
  UpdateDisplayScreenDto,
} from './dto/display-screen.dto';

const DEFAULT_PIN = '123456';
const PIN_ROW_ID = 'default';
const PIN_JWT_EXPIRES_SEC = 30 * 60;
const KIOSK_START_ROOM_FALLBACK = 'ce336956-b026-4979-8094-2c7bf7a5a53a';

type PinAttempt = { fails: number; blockedUntil: number };
const pinAttempts = new Map<string, PinAttempt>();

export type DisplayScreenPublic = {
  display_screen_id: string;
  code: string;
  name: string;
  kind: DisplayScreenKind;
  status: DisplayScreenStatus;
  room_id: string | null;
  settings: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  room?: {
    room_id: string;
    room_name: string;
    room_type: ClinicalRoomType;
  } | null;
};

function asSettings(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function defaultSettings(kind: DisplayScreenKind): Record<string, unknown> {
  switch (kind) {
    case DisplayScreenKind.KIOSK:
      return {
        enable_otp: true,
        floor_number: 1,
        start_room_code: '',
        start_room_label: '',
      };
    case DisplayScreenKind.TV_PHARMACY:
      return { media_enabled: true, sound_enabled: true };
    default:
      return {};
  }
}

@Injectable()
export class DisplayScreenService implements OnModuleInit {
  private readonly logger = new Logger(DisplayScreenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async onModuleInit() {
    try {
      await this.ensureDefaultPin();
    } catch (error) {
      this.logger.warn(
        `Chưa seed được PIN màn hình (bảng có thể chưa migrate): ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }

  toPublic(row: {
    display_screen_id: string;
    code: string;
    name: string;
    kind: DisplayScreenKind;
    status: DisplayScreenStatus;
    room_id: string | null;
    settings: Prisma.JsonValue;
    created_at: Date;
    updated_at: Date;
    room?: {
      room_id: string;
      room_name: string;
      room_type: ClinicalRoomType;
    } | null;
  }): DisplayScreenPublic {
    return {
      display_screen_id: row.display_screen_id,
      code: row.code,
      name: row.name,
      kind: row.kind,
      status: row.status,
      room_id: row.room_id,
      settings: asSettings(row.settings),
      created_at: row.created_at,
      updated_at: row.updated_at,
      room: row.room ?? null,
    };
  }

  async list(query: QueryDisplayScreenDto): Promise<DisplayScreenPublic[]> {
    const rows = await this.prisma.display_Screen.findMany({
      where: {
        ...(query.kind ? { kind: query.kind } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: {
        room: {
          select: { room_id: true, room_name: true, room_type: true },
        },
      },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    });
    return rows.map((row) => this.toPublic(row));
  }

  async findOne(id: string): Promise<DisplayScreenPublic> {
    const row = await this.prisma.display_Screen.findUnique({
      where: { display_screen_id: id },
      include: {
        room: {
          select: { room_id: true, room_name: true, room_type: true },
        },
      },
    });
    if (!row) {
      throw new NotFoundException(`Không tìm thấy màn hình với ID: ${id}`);
    }
    return this.toPublic(row);
  }

  async create(dto: CreateDisplayScreenDto): Promise<DisplayScreenPublic> {
    await this.assertRoomForKind(dto.kind, dto.room_id);
    const settings = {
      ...defaultSettings(dto.kind),
      ...(dto.settings ?? {}),
    };
    try {
      const row = await this.prisma.display_Screen.create({
        data: {
          code: dto.code.trim(),
          name: dto.name.trim(),
          kind: dto.kind,
          status: dto.status ?? DisplayScreenStatus.ENABLED,
          room_id: dto.room_id ?? null,
          settings: settings as Prisma.InputJsonValue,
        },
        include: {
          room: {
            select: { room_id: true, room_name: true, room_type: true },
          },
        },
      });
      return this.toPublic(row);
    } catch (error) {
      this.rethrowUnique(error, dto.code);
      throw error;
    }
  }

  async update(id: string, dto: UpdateDisplayScreenDto): Promise<DisplayScreenPublic> {
    const current = await this.prisma.display_Screen.findUnique({
      where: { display_screen_id: id },
    });
    if (!current) {
      throw new NotFoundException(`Không tìm thấy màn hình với ID: ${id}`);
    }
    if (dto.room_id !== undefined) {
      await this.assertRoomForKind(current.kind, dto.room_id);
    }
    const nextSettings =
      dto.settings !== undefined
        ? { ...asSettings(current.settings), ...dto.settings }
        : undefined;
    try {
      const row = await this.prisma.display_Screen.update({
        where: { display_screen_id: id },
        data: {
          ...(dto.code !== undefined ? { code: dto.code.trim() } : {}),
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.room_id !== undefined ? { room_id: dto.room_id } : {}),
          ...(nextSettings !== undefined
            ? { settings: nextSettings as Prisma.InputJsonValue }
            : {}),
        },
        include: {
          room: {
            select: { room_id: true, room_name: true, room_type: true },
          },
        },
      });
      return this.toPublic(row);
    } catch (error) {
      if (dto.code) this.rethrowUnique(error, dto.code);
      throw error;
    }
  }

  async disable(id: string): Promise<DisplayScreenPublic> {
    return this.update(id, { status: DisplayScreenStatus.DISABLED });
  }

  async findOrCreateClinic(
    dto: FindOrCreateClinicDisplayDto,
  ): Promise<DisplayScreenPublic> {
    const room = await this.prisma.room.findUnique({
      where: { room_id: dto.room_id },
      select: { room_id: true, room_name: true, room_type: true },
    });
    if (!room) {
      throw new NotFoundException(`Không tìm thấy phòng với ID: ${dto.room_id}`);
    }

    const existing = await this.prisma.display_Screen.findFirst({
      where: {
        kind: DisplayScreenKind.TV_CLINIC,
        room_id: dto.room_id,
      },
      include: {
        room: {
          select: { room_id: true, room_name: true, room_type: true },
        },
      },
      orderBy: { created_at: 'asc' },
    });
    if (existing) return this.toPublic(existing);

    const suffix = dto.room_id.replace(/-/g, '').slice(0, 8).toUpperCase();
    const row = await this.prisma.display_Screen.create({
      data: {
        code: `TV-PK-${suffix}`,
        name: `TV ${room.room_name}`,
        kind: DisplayScreenKind.TV_CLINIC,
        status: DisplayScreenStatus.ENABLED,
        room_id: room.room_id,
        settings: {},
      },
      include: {
        room: {
          select: { room_id: true, room_name: true, room_type: true },
        },
      },
    });
    return this.toPublic(row);
  }

  async findOrCreatePayment(
    dto: FindOrCreatePaymentDisplayDto = {},
  ): Promise<DisplayScreenPublic> {
    const existing = await this.prisma.display_Screen.findFirst({
      where: { kind: DisplayScreenKind.TV_PAYMENT },
      include: {
        room: {
          select: { room_id: true, room_name: true, room_type: true },
        },
      },
      orderBy: { created_at: 'asc' },
    });
    if (existing) return this.toPublic(existing);

    let roomId = dto.room_id ?? null;
    if (roomId) {
      await this.assertRoomForKind(DisplayScreenKind.TV_PAYMENT, roomId);
    } else {
      const cashier = await this.prisma.room.findFirst({
        where: { room_type: ClinicalRoomType.CASHIER },
        orderBy: { created_at: 'asc' },
        select: { room_id: true },
      });
      roomId = cashier?.room_id ?? null;
    }

    const row = await this.prisma.display_Screen.create({
      data: {
        code: 'TV-TT-1',
        name: 'TV Thanh toán',
        kind: DisplayScreenKind.TV_PAYMENT,
        status: DisplayScreenStatus.ENABLED,
        room_id: roomId,
        settings: {},
      },
      include: {
        room: {
          select: { room_id: true, room_name: true, room_type: true },
        },
      },
    });
    return this.toPublic(row);
  }

  async verifyPin(pin: string, clientKey: string) {
    this.assertPinNotBlocked(clientKey);
    const row = await this.ensureDefaultPin();
    const ok = await verifyDisplayPin(pin, row.pin_hash);
    if (!ok) {
      this.recordPinFailure(clientKey);
      throw new UnauthorizedException({
        message: 'Mã PIN không chính xác',
        detail: 'Vui lòng thử lại.',
      });
    }
    pinAttempts.delete(clientKey);

    const access_token = await this.jwtService.signAsync(
      {
        sub: 'display-pin',
        type: DISPLAY_PIN_TOKEN_TYPE,
      },
      { expiresIn: PIN_JWT_EXPIRES_SEC },
    );

    return {
      access_token,
      token_type: 'Bearer',
      expires_in: PIN_JWT_EXPIRES_SEC,
    };
  }

  async changePin(dto: ChangeDisplayPinDto) {
    const row = await this.ensureDefaultPin();
    const ok = await verifyDisplayPin(dto.current_pin, row.pin_hash);
    if (!ok) {
      throw new UnauthorizedException({
        message: 'PIN hiện tại không đúng',
        detail: 'Không thể đổi PIN toàn hệ thống.',
      });
    }
    if (dto.current_pin === dto.new_pin) {
      throw new BadRequestException('PIN mới phải khác PIN hiện tại.');
    }
    const pin_hash = await hashDisplayPin(dto.new_pin);
    await this.prisma.display_Pin.update({
      where: { id: PIN_ROW_ID },
      data: { pin_hash },
    });
    return { ok: true };
  }

  async assertPharmacyScreen(displayScreenId: string) {
    const screen = await this.prisma.display_Screen.findUnique({
      where: { display_screen_id: displayScreenId },
      include: {
        room: {
          select: { room_id: true, room_name: true, room_type: true },
        },
      },
    });
    if (!screen) {
      throw new NotFoundException(
        `Không tìm thấy màn hình quầy với ID: ${displayScreenId}`,
      );
    }
    if (screen.kind !== DisplayScreenKind.TV_PHARMACY) {
      throw new BadRequestException(
        'Màn hình này không phải quầy nhà thuốc (TV_PHARMACY).',
      );
    }
    if (screen.status !== DisplayScreenStatus.ENABLED) {
      throw new BadRequestException(
        'Quầy này đã bị tắt. Chọn quầy ENABLED khác trước khi soạn thuốc.',
      );
    }
    return this.toPublic(screen);
  }

  async ensureDefaultPin() {
    const existing = await this.prisma.display_Pin.findUnique({
      where: { id: PIN_ROW_ID },
    });
    if (existing) return existing;
    const pin_hash = await hashDisplayPin(DEFAULT_PIN);
    return this.prisma.display_Pin.create({
      data: { id: PIN_ROW_ID, pin_hash },
    });
  }

  async resolveKioskStartRoomId(): Promise<string | null> {
    const preferred = await this.prisma.room.findUnique({
      where: { room_id: KIOSK_START_ROOM_FALLBACK },
      select: { room_id: true },
    });
    if (preferred) return preferred.room_id;
    const fallback = await this.prisma.room.findFirst({
      where: {
        room_type: {
          in: [ClinicalRoomType.RECEPTION, ClinicalRoomType.TRIAGE_AREA],
        },
      },
      orderBy: { created_at: 'asc' },
      select: { room_id: true },
    });
    return fallback?.room_id ?? null;
  }

  private async assertRoomForKind(
    kind: DisplayScreenKind,
    roomId?: string | null,
  ) {
    if (!roomId) return;
    const room = await this.prisma.room.findUnique({
      where: { room_id: roomId },
      select: { room_id: true, room_type: true },
    });
    if (!room) {
      throw new NotFoundException(`Không tìm thấy phòng với ID: ${roomId}`);
    }
    if (kind === DisplayScreenKind.TV_PHARMACY && room.room_type !== ClinicalRoomType.PHARMACY) {
      throw new BadRequestException(
        'TV nhà thuốc phải gắn phòng loại PHARMACY.',
      );
    }
    if (kind === DisplayScreenKind.TV_PAYMENT && room.room_type !== ClinicalRoomType.CASHIER) {
      throw new BadRequestException(
        'TV thanh toán nên gắn phòng loại CASHIER.',
      );
    }
  }

  private rethrowUnique(error: unknown, code: string): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new BadRequestException(`Mã màn hình "${code}" đã tồn tại.`);
    }
  }

  private assertPinNotBlocked(clientKey: string) {
    const attempt = pinAttempts.get(clientKey);
    if (!attempt) return;
    const now = Date.now();
    if (attempt.blockedUntil > now) {
      const waitSec = Math.ceil((attempt.blockedUntil - now) / 1000);
      throw new HttpException(
        {
          message: 'Thử PIN quá nhiều lần',
          detail: `Vui lòng đợi ${waitSec} giây rồi thử lại.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private recordPinFailure(clientKey: string) {
    const prev = pinAttempts.get(clientKey) ?? { fails: 0, blockedUntil: 0 };
    const fails = prev.fails + 1;
    const delayMs =
      fails >= 10 ? 30_000 : fails >= 5 ? 5_000 : fails >= 3 ? 1_500 : 0;
    pinAttempts.set(clientKey, {
      fails,
      blockedUntil: Date.now() + delayMs,
    });
  }
}
