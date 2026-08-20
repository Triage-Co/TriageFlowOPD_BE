import { isAppointmentOnTime } from './queue.service';
import { buildQueueDateFilter } from './queue.constants';

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
