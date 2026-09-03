import { isAppointmentOnTime, QueueService } from './queue.service';
import {
  QueueStatusEnum,
  QueueTypeEnum,
  StepTypeEnum,
} from '@prisma/client';
import {
  buildQueueDateFilter,
  pickSameDayFlaggedSession,
  pickUnbookedFlaggedSession,
  resolveManualCodesForEnqueue,
  isAppointmentSlotDue,
  shouldDeferAppointmentQueue,
  normalizeHmTime,
} from './queue.constants';

describe('QueueService isAppointmentOnTime', () => {
  const shiftDate = new Date('2026-08-04T00:00:00.000Z');
  const timeZone = 'Asia/Ho_Chi_Minh';

  it('should return true when checkTime is within slot time (including 30 mins early)', () => {
    // Slot 09:00 - 10:00
    // Check-in window: 08:30 - 10:00:59
    const earlyCheck = new Date('2026-08-04T08:35:00+07:00');
    expect(
      isAppointmentOnTime('09:00', '10:00', shiftDate, earlyCheck, timeZone),
    ).toBe(true);

    const exactStart = new Date('2026-08-04T09:00:00+07:00');
    expect(
      isAppointmentOnTime('09:00', '10:00', shiftDate, exactStart, timeZone),
    ).toBe(true);

    const middleSlot = new Date('2026-08-04T09:30:00+07:00');
    expect(
      isAppointmentOnTime('09:00', '10:00', shiftDate, middleSlot, timeZone),
    ).toBe(true);
  });

  it('should return false when checkTime is too early (more than 30 mins before slot start)', () => {
    // 08:25 for slot starting 09:00 -> too early
    const tooEarly = new Date('2026-08-04T08:25:00+07:00');
    expect(
      isAppointmentOnTime('09:00', '10:00', shiftDate, tooEarly, timeZone),
    ).toBe(false);
  });

  it('should return false when checkTime is after slot end', () => {
    // 10:05 for slot ending 10:00 -> late
    const tooLate = new Date('2026-08-04T10:05:00+07:00');
    expect(
      isAppointmentOnTime('09:00', '10:00', shiftDate, tooLate, timeZone),
    ).toBe(false);
  });

  it('should return false if parameters are missing', () => {
    expect(isAppointmentOnTime('', '10:00', shiftDate)).toBe(false);
  });
});

describe('buildQueueDateFilter', () => {
  const startOfDay = new Date('2026-08-19T00:00:00.000Z');
  const endOfDay = new Date('2026-08-19T23:59:59.999Z');

  it('should build OR condition with shift date range and fallback created_at range', () => {
    const filter = buildQueueDateFilter(startOfDay, endOfDay);
    expect(filter.OR).toBeDefined();
    expect(filter.OR).toHaveLength(2);

    const appointmentBranch = filter.OR![0] as any;
    expect(
      appointmentBranch.step.flow.booking.slot.shift.date,
    ).toEqual({
      gte: startOfDay,
      lte: endOfDay,
    });

    const walkInBranch = filter.OR![1] as any;
    expect(walkInBranch.created_at).toEqual({
      gte: startOfDay,
      lte: endOfDay,
    });
    expect(walkInBranch.step.OR).toEqual([
      { flow_id: null },
      { flow: null },
    ]);
  });

  it('should build open-ended condition when endOfDay is omitted', () => {
    const filter = buildQueueDateFilter(startOfDay);
    const appointmentBranch = filter.OR![0] as any;
    expect(
      appointmentBranch.step.flow.booking.slot.shift.date,
    ).toEqual({
      gte: startOfDay,
    });

    const walkInBranch = filter.OR![1] as any;
    expect(walkInBranch.created_at).toEqual({
      gte: startOfDay,
    });
  });
});

describe('QueueService Payload Builders', () => {
  const service = new (class extends (jest.requireActual('./queue.service').QueueService) {
    constructor() {
      super(null, null, null, null, null, null, null);
    }
  })();

  it('buildServingPayload should format patient, step, and service order properly', () => {
    const rawServingQueue = {
      queue_id: 'q-1',
      queue_number: 'A001',
      serving_started_at: new Date('2026-08-20T08:00:00.000Z'),
      step: {
        step_id: 'step-1',
        step_name: 'Khám Nội',
        step_type: 'CLINICAL',
        step_status: 'IN_PROGRESS',
        service_code: 'KNOI',
        flow: {
          booking: {
            patient: {
              patient_id: 'pat-1',
              full_name: 'Nguyen Van A',
              dob: new Date('1990-01-01'),
              gender: 'MALE',
              citizen_id: '012345678901',
              account: { phone: '0901234567' },
            },
          },
        },
        service_order: {
          service_order_id: 'so-1',
          name: 'Đơn khám 1',
          status: 'IN_PROGRESS',
          serviceOrderDetails: [
            {
              service_order_detail_id: 'sod-1',
              name: 'Khám tổng quát',
              service_id: 'srv-1',
              quantity: 1,
              status: 'IN_PROGRESS',
              service: {
                service_code: 'KTQ',
                service_name: 'Khám tổng quát',
              },
            },
          ],
        },
      },
    };

    const payload = service.buildServingPayload(rawServingQueue);

    expect(payload).toEqual({
      queue_id: 'q-1',
      queue_number: 'A001',
      serving_started_at: expect.any(Date),
      patient: {
        patient_id: 'pat-1',
        full_name: 'Nguyen Van A',
        dob: expect.any(Date),
        gender: 'MALE',
        phone: '0901234567',
        citizen_id: '012345678901',
      },
      step: {
        step_id: 'step-1',
        step_name: 'Khám Nội',
        step_type: 'CLINICAL',
        step_status: 'IN_PROGRESS',
        service_code: 'KNOI',
      },
      service_order: {
        service_order_id: 'so-1',
        name: 'Đơn khám 1',
        status: 'IN_PROGRESS',
        details: [
          {
            service_order_detail_id: 'sod-1',
            name: 'Khám tổng quát',
            service_id: 'srv-1',
            service_code: 'KTQ',
            service_name: 'Khám tổng quát',
            quantity: 1,
            status: 'IN_PROGRESS',
          },
        ],
      },
    });
  });

  it('buildFinishedPayload should calculate duration and include refusal_reason', () => {
    const rawFinishedQueue = {
      queue_id: 'q-2',
      queue_number: 'B002',
      queue_type: 'NORMAL',
      status: 'CANCELLED',
      serving_started_at: new Date('2026-08-20T08:00:00.000Z'),
      finished_at: new Date('2026-08-20T08:15:00.000Z'),
      step: {
        step_id: 'step-2',
        step_name: 'Khám Mắt',
        step_type: 'CLINICAL',
        step_status: 'DECLINED',
        service_code: 'KMAT',
        flow: {
          booking: {
            patient: {
              patient_id: 'pat-2',
              full_name: 'Tran Thi B',
              dob: new Date('1995-05-05'),
              gender: 'FEMALE',
              citizen_id: '098765432109',
              account: { phone: '0987654321' },
            },
          },
        },
        service_order: null,
      },
      moveLogs: [
        {
          action_type: 'DECLINED',
          reason: 'Bệnh nhân xin hủy do có việc bận',
        },
      ],
    };

    const payload = service.buildFinishedPayload(rawFinishedQueue);

    expect(payload).toEqual({
      queue_id: 'q-2',
      queue_number: 'B002',
      queue_type: 'NORMAL',
      status: 'CANCELLED',
      serving_started_at: expect.any(Date),
      finished_at: expect.any(Date),
      duration_minutes: 15,
      refusal_reason: 'Bệnh nhân xin hủy do có việc bận',
      patient: {
        patient_id: 'pat-2',
        full_name: 'Tran Thi B',
        dob: expect.any(Date),
        gender: 'FEMALE',
        phone: '0987654321',
        citizen_id: '098765432109',
      },
      step: {
        step_id: 'step-2',
        step_name: 'Khám Mắt',
        step_type: 'CLINICAL',
        step_status: 'DECLINED',
        service_code: 'KMAT',
      },
      service_order: null,
    });
  });
});

describe('pickSameDayFlaggedSession', () => {
  const day = new Date('2026-09-02T03:00:00.000Z');

  it('prefers the booking-attached session, then unbooked reception flags', () => {
    const sessions = [
      {
        booking_id: 'other-booking',
        visit_date: day,
        manual_rule_codes: ['OTHER'],
      },
      {
        booking_id: null,
        visit_date: day,
        manual_rule_codes: ['ELDERLY', 'PREGNANT'],
      },
      {
        booking_id: 'booking-1',
        visit_date: day,
        manual_rule_codes: ['RETURNING'],
      },
    ];

    expect(
      pickSameDayFlaggedSession(sessions, 'booking-1')?.manual_rule_codes,
    ).toEqual(['RETURNING']);
    expect(pickSameDayFlaggedSession(sessions)?.manual_rule_codes).toEqual([
      'ELDERLY',
      'PREGNANT',
    ]);
  });

  it('skips empty arrays and returns undefined when nothing is flagged', () => {
    const sessions = [
      {
        booking_id: null,
        visit_date: day,
        manual_rule_codes: [],
      },
      {
        booking_id: null,
        visit_date: day,
        manual_rule_codes: null,
      },
    ];
    expect(pickSameDayFlaggedSession(sessions, 'booking-1')).toBeUndefined();
  });
});

describe('pickUnbookedFlaggedSession', () => {
  const day = new Date('2026-09-02T03:00:00.000Z');

  it('attaches only an unbooked session that has flags', () => {
    const sessions = [
      {
        booking_id: null,
        visit_date: day,
        manual_rule_codes: [],
      },
      {
        booking_id: null,
        visit_date: day,
        manual_rule_codes: ['PEDIATRIC'],
      },
      {
        booking_id: 'other',
        visit_date: day,
        manual_rule_codes: ['GERIATRIC'],
      },
    ];
    expect(pickUnbookedFlaggedSession(sessions)?.manual_rule_codes).toEqual([
      'PEDIATRIC',
    ]);
  });

  it('does not reuse an unflagged walk-in session', () => {
    const sessions = [
      {
        booking_id: null,
        visit_date: day,
        manual_rule_codes: [],
      },
      {
        booking_id: 'other',
        visit_date: day,
        manual_rule_codes: ['GERIATRIC'],
      },
    ];
    expect(pickUnbookedFlaggedSession(sessions)).toBeUndefined();
  });
});

describe('resolveManualCodesForEnqueue copies visit flags when queue is empty', () => {
  it('keeps existing queue codes and does not copy', () => {
    expect(
      resolveManualCodesForEnqueue(['QUEUE_FLAG'], ['VISIT_FLAG'], ['FALLBACK']),
    ).toEqual({ codes: ['QUEUE_FLAG'], copyToQueue: false });
  });

  it('copies visit-session codes onto an empty queue', () => {
    expect(
      resolveManualCodesForEnqueue([], ['ELDERLY', 'PREGNANT'], ['FALLBACK']),
    ).toEqual({
      codes: ['ELDERLY', 'PREGNANT'],
      copyToQueue: true,
    });
  });

  it('falls back to the latest flagged same-day session when visit session has none', () => {
    expect(
      resolveManualCodesForEnqueue(null, [], ['ELDERLY']),
    ).toEqual({ codes: ['ELDERLY'], copyToQueue: true });
  });

  it('does not copy when every source is empty', () => {
    expect(resolveManualCodesForEnqueue(null, null, [])).toEqual({
      codes: [],
      copyToQueue: false,
    });
  });
});

describe('isAppointmentSlotDue', () => {
  const timeZone = 'Asia/Ho_Chi_Minh';
  const shiftDate = new Date('2026-09-03T00:00:00+07:00');

  it('returns true at slot start and later the same day', () => {
    expect(
      isAppointmentSlotDue(
        '15:00',
        shiftDate,
        new Date('2026-09-03T15:00:00+07:00'),
        timeZone,
      ),
    ).toBe(true);
    expect(
      isAppointmentSlotDue(
        '15:00:00',
        shiftDate,
        new Date('2026-09-03T15:05:00+07:00'),
        timeZone,
      ),
    ).toBe(true);
  });

  it('returns false before slot start on the same day', () => {
    expect(
      isAppointmentSlotDue(
        '15:00',
        shiftDate,
        new Date('2026-09-03T14:59:00+07:00'),
        timeZone,
      ),
    ).toBe(false);
  });

  it('returns false on a different calendar day', () => {
    expect(
      isAppointmentSlotDue(
        '15:00',
        shiftDate,
        new Date('2026-09-02T16:00:00+07:00'),
        timeZone,
      ),
    ).toBe(false);
  });

  it('normalizes HH:mm:ss start times', () => {
    expect(normalizeHmTime('15:00:00')).toBe('15:00');
    expect(normalizeHmTime('9:5')).toBe('09:05');
  });
});

describe('shouldDeferAppointmentQueue', () => {
  const shiftDate = new Date('2026-09-03T00:00:00+07:00');
  const noon = new Date('2026-09-03T12:00:00+07:00');

  it('defers future CLINICAL APPOINTMENT slots', () => {
    expect(
      shouldDeferAppointmentQueue({
        queueType: QueueTypeEnum.APPOINTMENT,
        stepType: StepTypeEnum.CLINICAL,
        slotStartTime: '15:00',
        shiftDate,
        now: noon,
      }),
    ).toBe(true);
  });

  it('does not defer when the slot is already due', () => {
    expect(
      shouldDeferAppointmentQueue({
        queueType: QueueTypeEnum.APPOINTMENT,
        stepType: StepTypeEnum.CLINICAL,
        slotStartTime: '11:00',
        shiftDate,
        now: noon,
      }),
    ).toBe(false);
  });

  it('does not defer when activateNow (check-in)', () => {
    expect(
      shouldDeferAppointmentQueue({
        activateNow: true,
        queueType: QueueTypeEnum.APPOINTMENT,
        stepType: StepTypeEnum.CLINICAL,
        slotStartTime: '15:00',
        shiftDate,
        now: noon,
      }),
    ).toBe(false);
  });

  it('does not defer CLS or RETURNING', () => {
    expect(
      shouldDeferAppointmentQueue({
        queueType: QueueTypeEnum.APPOINTMENT,
        stepType: StepTypeEnum.LAB_TEST,
        slotStartTime: '15:00',
        shiftDate,
        now: noon,
      }),
    ).toBe(false);
    expect(
      shouldDeferAppointmentQueue({
        queueType: QueueTypeEnum.RETURNING,
        stepType: StepTypeEnum.CLINICAL,
        slotStartTime: '15:00',
        shiftDate,
        now: noon,
      }),
    ).toBe(false);
  });
});

describe('QueueService enqueueStep appointment deferral', () => {
  const shiftDate = new Date('2026-09-03T00:00:00+07:00');
  const originalEngineFlag = process.env.QUEUE_ENGINE_ENABLED;

  beforeAll(() => {
    process.env.QUEUE_ENGINE_ENABLED = 'false';
    jest.useFakeTimers({ now: new Date('2026-09-03T05:00:00.000Z') });
  });

  afterAll(() => {
    jest.useRealTimers();
    if (originalEngineFlag === undefined) {
      delete process.env.QUEUE_ENGINE_ENABLED;
    } else {
      process.env.QUEUE_ENGINE_ENABLED = originalEngineFlag;
    }
  });

  function makeStep(overrides?: {
    startTime?: string;
    stepType?: StepTypeEnum;
  }) {
    return {
      step_id: 'step-1',
      room_id: 'room-1',
      step_type: overrides?.stepType ?? StepTypeEnum.CLINICAL,
      room: { room_type: 'CLINICAL_ROOM', specialty_id: null },
      flow: {
        booking: {
          patient_id: 'p1',
          patient: { patient_id: 'p1', dob: null, gender: 'MALE' },
          slot: {
            start_time: overrides?.startTime ?? '15:00',
            end_time: '15:15',
            shift: { date: shiftDate },
          },
          visitSession: {
            temperature: null,
            heart_rate: null,
            spo2: null,
            blood_pressure_sys: null,
            manual_rule_codes: ['X'],
          },
        },
      },
    };
  }

  function createService() {
    const createdQueues: Array<Record<string, unknown>> = [];
    const tx = {
      step: { findUnique: jest.fn() },
      queue: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(async ({ data }) => {
          const row = {
            queue_id: 'q-1',
            room_id: data.room_id,
            step_id: data.step_id,
            status: data.status,
            queue_type: data.queue_type,
            queue_number: data.queue_number,
          };
          createdQueues.push(row);
          return row;
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (fn: (client: typeof tx) => unknown) =>
        fn(tx),
      ),
      step: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ step_type: StepTypeEnum.CLINICAL }),
      },
    };
    const service = new QueueService(
      prisma as never,
      { evaluateRulesForEntry: jest.fn() } as never,
      {} as never,
      { emitQueueUpdate: jest.fn() } as never,
      { scheduleDetectAndSuggest: jest.fn() } as never,
      {} as never,
      {
        invalidateRoom: jest.fn(),
        getDisplayPayload: jest.fn(),
        setDisplayPayload: jest.fn(),
      } as never,
    );
    jest.spyOn(service, 'broadcastRoomUpdate').mockResolvedValue(undefined);
    return { service, tx, createdQueues };
  }

  it('creates PENDING for a future CLINICAL appointment', async () => {
    const { service, tx } = createService();
    tx.step.findUnique.mockResolvedValue(makeStep({ startTime: '15:00' }));

    const result = await service.enqueueStep(
      'step-1',
      QueueTypeEnum.APPOINTMENT,
    );

    expect(result.status).toBe(QueueStatusEnum.PENDING);
    expect(tx.queue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: QueueStatusEnum.PENDING }),
      }),
    );
  });

  it('creates QUEUED when the appointment slot is already due', async () => {
    const { service, tx } = createService();
    tx.step.findUnique.mockResolvedValue(makeStep({ startTime: '11:00' }));

    const result = await service.enqueueStep(
      'step-1',
      QueueTypeEnum.APPOINTMENT,
    );

    expect(result.status).toBe(QueueStatusEnum.QUEUED);
  });

  it('creates QUEUED when activateNow even if the slot is in the future', async () => {
    const { service, tx } = createService();
    tx.step.findUnique.mockResolvedValue(makeStep({ startTime: '15:00' }));

    const result = await service.enqueueStep(
      'step-1',
      QueueTypeEnum.APPOINTMENT,
      undefined,
      { activateNow: true },
    );

    expect(result.status).toBe(QueueStatusEnum.QUEUED);
  });

  it('does not defer CLS appointment steps', async () => {
    const { service, tx } = createService();
    tx.step.findUnique.mockResolvedValue(
      makeStep({ startTime: '15:00', stepType: StepTypeEnum.LAB_TEST }),
    );

    const result = await service.enqueueStep(
      'step-1',
      QueueTypeEnum.APPOINTMENT,
    );

    expect(result.status).toBe(QueueStatusEnum.QUEUED);
  });

  it('does not defer RETURNING', async () => {
    const { service, tx } = createService();
    tx.step.findUnique.mockResolvedValue(makeStep({ startTime: '15:00' }));

    const result = await service.enqueueStep(
      'step-1',
      QueueTypeEnum.RETURNING,
    );

    expect(result.status).toBe(QueueStatusEnum.QUEUED);
  });
});
