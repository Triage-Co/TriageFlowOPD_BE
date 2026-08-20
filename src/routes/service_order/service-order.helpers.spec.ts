import {
  ClinicalRoomType,
  StepStatusEnum,
  StepTypeEnum,
} from '@prisma/client';
import {
  isClsStepType,
  isPharmacyRoomType,
  isReturnServiceCode,
  isStepSatisfied,
  LEGACY_RETURN_SERVICE_CODE,
  pickAnchorStep,
  pickLatestReturnStep,
  resolveReturnStepPlan,
  RETURN_SERVICE_CODE,
  roomTypeToStepType,
  type FlowStepLike,
} from './service-order.helpers';

function step(partial: Partial<FlowStepLike> & { step_id: string }): FlowStepLike {
  return {
    step_status: StepStatusEnum.PENDING,
    created_at: new Date('2026-01-01T00:00:00Z'),
    ...partial,
  };
}

describe('service-order.helpers', () => {
  describe('roomTypeToStepType', () => {
    it('maps clinical room types used for SO grouping', () => {
      expect(roomTypeToStepType(ClinicalRoomType.LABORATORY)).toBe(
        StepTypeEnum.LAB_TEST,
      );
      expect(roomTypeToStepType(ClinicalRoomType.IMAGING_ROOM)).toBe(
        StepTypeEnum.IMAGING,
      );
      expect(roomTypeToStepType(ClinicalRoomType.PROCEDURE_ROOM)).toBe(
        StepTypeEnum.PROCEDURE,
      );
      expect(roomTypeToStepType(ClinicalRoomType.FUNCTIONAL_EXPLORATION)).toBe(
        StepTypeEnum.FUNCTIONAL_EXPLORATION,
      );
      expect(roomTypeToStepType(ClinicalRoomType.CLINICAL_ROOM)).toBe(
        StepTypeEnum.CLINICAL,
      );
      expect(roomTypeToStepType(ClinicalRoomType.PHARMACY)).toBe(
        StepTypeEnum.DISPENSING,
      );
    });
  });

  describe('isPharmacyRoomType', () => {
    it('is true only for PHARMACY', () => {
      expect(isPharmacyRoomType(ClinicalRoomType.PHARMACY)).toBe(true);
      expect(isPharmacyRoomType(ClinicalRoomType.LABORATORY)).toBe(false);
    });
  });

  describe('isReturnServiceCode', () => {
    it('accepts the canonical and legacy codes', () => {
      expect(isReturnServiceCode(RETURN_SERVICE_CODE)).toBe(true);
      expect(isReturnServiceCode(LEGACY_RETURN_SERVICE_CODE)).toBe(true);
      expect(isReturnServiceCode('XN_MAU_CB')).toBe(false);
      expect(isReturnServiceCode(null)).toBe(false);
    });
  });

  describe('isClsStepType', () => {
    it('is true for lab, imaging, procedure, functional exploration', () => {
      expect(isClsStepType(StepTypeEnum.LAB_TEST)).toBe(true);
      expect(isClsStepType(StepTypeEnum.IMAGING)).toBe(true);
      expect(isClsStepType(StepTypeEnum.PROCEDURE)).toBe(true);
      expect(isClsStepType(StepTypeEnum.FUNCTIONAL_EXPLORATION)).toBe(true);
      expect(isClsStepType(StepTypeEnum.CLINICAL)).toBe(false);
      expect(isClsStepType(StepTypeEnum.DISPENSING)).toBe(false);
      expect(isClsStepType(StepTypeEnum.PAYMENT)).toBe(false);
    });
  });

  describe('isStepSatisfied', () => {
    it('treats completed, declined, and cancelled as done', () => {
      expect(isStepSatisfied(StepStatusEnum.COMPLETED)).toBe(true);
      expect(isStepSatisfied(StepStatusEnum.DECLINED)).toBe(true);
      expect(isStepSatisfied(StepStatusEnum.CANCELLED)).toBe(true);
      expect(isStepSatisfied(StepStatusEnum.PENDING)).toBe(false);
      expect(isStepSatisfied(StepStatusEnum.IN_PROGRESS)).toBe(false);
    });
  });

  describe('pickAnchorStep', () => {
    it('skips cancelled, return, and dispensing steps', () => {
      const exam = step({
        step_id: 'exam',
        step_type: StepTypeEnum.CLINICAL,
        created_at: new Date('2026-01-01T08:00:00Z'),
      });
      const payment = step({
        step_id: 'pay',
        step_type: StepTypeEnum.PAYMENT,
        created_at: new Date('2026-01-01T09:00:00Z'),
      });
      const cls = step({
        step_id: 'cls',
        step_type: StepTypeEnum.LAB_TEST,
        created_at: new Date('2026-01-01T10:00:00Z'),
      });
      const ret = step({
        step_id: 'ret',
        service_code: RETURN_SERVICE_CODE,
        step_type: StepTypeEnum.CLINICAL,
        created_at: new Date('2026-01-01T11:00:00Z'),
      });
      const pharmacy = step({
        step_id: 'rx',
        step_type: StepTypeEnum.DISPENSING,
        created_at: new Date('2026-01-01T12:00:00Z'),
      });
      const cancelled = step({
        step_id: 'old',
        step_type: StepTypeEnum.IMAGING,
        step_status: StepStatusEnum.CANCELLED,
        created_at: new Date('2026-01-01T13:00:00Z'),
      });

      const picked = pickAnchorStep([
        exam,
        payment,
        cls,
        ret,
        pharmacy,
        cancelled,
      ]);
      expect(picked?.step_id).toBe('cls');
    });

    it('ignores sub-steps', () => {
      const parent = step({
        step_id: 'parent',
        step_type: StepTypeEnum.CLINICAL,
      });
      const child = step({
        step_id: 'child',
        step_type: StepTypeEnum.LAB_TEST,
        parent_step_id: 'parent',
        created_at: new Date('2026-01-01T20:00:00Z'),
      });
      expect(pickAnchorStep([parent, child])?.step_id).toBe('parent');
    });
  });

  describe('pickLatestReturnStep', () => {
    it('returns the newest non-cancelled return', () => {
      const first = step({
        step_id: 'r1',
        service_code: LEGACY_RETURN_SERVICE_CODE,
        step_status: StepStatusEnum.COMPLETED,
        created_at: new Date('2026-01-01T08:00:00Z'),
      });
      const second = step({
        step_id: 'r2',
        service_code: RETURN_SERVICE_CODE,
        step_status: StepStatusEnum.PENDING,
        created_at: new Date('2026-01-01T10:00:00Z'),
      });
      expect(pickLatestReturnStep([first, second])?.step_id).toBe('r2');
    });
  });

  describe('resolveReturnStepPlan', () => {
    const exam = step({
      step_id: 'exam',
      step_type: StepTypeEnum.CLINICAL,
      created_at: new Date('2026-01-01T08:00:00Z'),
    });

    it('skips when no new CLS steps', () => {
      expect(resolveReturnStepPlan([exam], false)).toEqual({ action: 'skip' });
    });

    it('creates a return on the first CLS batch', () => {
      expect(resolveReturnStepPlan([exam], true)).toEqual({
        action: 'create',
        paymentAnchorId: 'exam',
      });
    });

    it('extends a PENDING return and anchors payment away from it', () => {
      const cls = step({
        step_id: 'cls',
        step_type: StepTypeEnum.LAB_TEST,
        created_at: new Date('2026-01-01T09:00:00Z'),
      });
      const ret = step({
        step_id: 'ret',
        service_code: RETURN_SERVICE_CODE,
        step_type: StepTypeEnum.CLINICAL,
        step_status: StepStatusEnum.PENDING,
        created_at: new Date('2026-01-01T10:00:00Z'),
      });
      const pharmacy = step({
        step_id: 'rx',
        step_type: StepTypeEnum.DISPENSING,
        created_at: new Date('2026-01-01T11:00:00Z'),
      });

      expect(resolveReturnStepPlan([exam, cls, ret, pharmacy], true)).toEqual({
        action: 'extend',
        returnStepId: 'ret',
        paymentAnchorId: 'cls',
      });
    });

    it('creates return #2 when the open return is IN_PROGRESS', () => {
      const ret = step({
        step_id: 'ret',
        service_code: RETURN_SERVICE_CODE,
        step_type: StepTypeEnum.CLINICAL,
        step_status: StepStatusEnum.IN_PROGRESS,
        created_at: new Date('2026-01-01T10:00:00Z'),
      });

      expect(resolveReturnStepPlan([exam, ret], true)).toEqual({
        action: 'create',
        paymentAnchorId: 'ret',
      });
    });

    it('creates return #2 after a COMPLETED return without waiting on it', () => {
      const cls = step({
        step_id: 'cls',
        step_type: StepTypeEnum.LAB_TEST,
        step_status: StepStatusEnum.COMPLETED,
        created_at: new Date('2026-01-01T09:00:00Z'),
      });
      const ret = step({
        step_id: 'ret',
        service_code: LEGACY_RETURN_SERVICE_CODE,
        step_type: StepTypeEnum.CLINICAL,
        step_status: StepStatusEnum.COMPLETED,
        created_at: new Date('2026-01-01T10:00:00Z'),
      });

      expect(resolveReturnStepPlan([exam, cls, ret], true)).toEqual({
        action: 'create',
        paymentAnchorId: 'cls',
      });
    });
  });
});
