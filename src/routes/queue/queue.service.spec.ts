import { isAppointmentOnTime } from './queue.service';

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
