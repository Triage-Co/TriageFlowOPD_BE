import {
  ClinicalRoomType,
  StepStatusEnum,
  StepTypeEnum,
} from '@prisma/client';

/**
 * Model notes (SO + queue):
 * - Group / merge Service_Order by ClinicalRoomType (service.room_type), not ServiceTypeEnum.
 * - Order.type / Step.step_type are derived via roomTypeToStepType for storage / flow only.
 * - 1 SO = 1 physical room = 1 invoice = 1 queue (primary clinical step).
 * - N services in an SO => N clinical steps (1:1 service_code) + N details.
 * - PHARMACY orders never enter the clinical queue (dispensing / prescription flow owns them).
 */

export const RETURN_SERVICE_CODE = 'DOC_KET_QUA_CAN_LAM_SANG';
export const LEGACY_RETURN_SERVICE_CODE = 'DOC_QUA_KET_CAN_LAM_SANG';
export const RETURN_SERVICE_CODES: readonly string[] = [
  RETURN_SERVICE_CODE,
  LEGACY_RETURN_SERVICE_CODE,
];

export const CLS_STEP_TYPES: readonly StepTypeEnum[] = [
  StepTypeEnum.LAB_TEST,
  StepTypeEnum.IMAGING,
  StepTypeEnum.PROCEDURE,
  StepTypeEnum.FUNCTIONAL_EXPLORATION,
];

const CLS_STEP_TYPE_SET = new Set<StepTypeEnum>(CLS_STEP_TYPES);

export type FlowStepLike = {
  step_id: string;
  service_code?: string | null;
  step_type?: StepTypeEnum | null;
  step_status: StepStatusEnum;
  parent_step_id?: string | null;
  created_at?: Date | string | null;
};

export type ReturnStepPlan =
  | { action: 'skip' }
  | {
      action: 'extend';
      returnStepId: string;
      paymentAnchorId?: string;
    }
  | {
      action: 'create';
      paymentAnchorId?: string;
    };

/** room_type is the business grouping key; step type is derived for Step / Order.type. */
export function roomTypeToStepType(
  roomType: ClinicalRoomType | null | undefined,
): StepTypeEnum {
  switch (roomType) {
    case ClinicalRoomType.LABORATORY:
      return StepTypeEnum.LAB_TEST;
    case ClinicalRoomType.IMAGING_ROOM:
      return StepTypeEnum.IMAGING;
    case ClinicalRoomType.PROCEDURE_ROOM:
      return StepTypeEnum.PROCEDURE;
    case ClinicalRoomType.FUNCTIONAL_EXPLORATION:
      return StepTypeEnum.FUNCTIONAL_EXPLORATION;
    case ClinicalRoomType.PHARMACY:
      return StepTypeEnum.DISPENSING;
    case ClinicalRoomType.CLINICAL_ROOM:
    default:
      return StepTypeEnum.CLINICAL;
  }
}

export function isPharmacyRoomType(
  roomType: ClinicalRoomType | null | undefined,
): boolean {
  return roomType === ClinicalRoomType.PHARMACY;
}

export function isReturnServiceCode(
  serviceCode: string | null | undefined,
): boolean {
  if (!serviceCode) return false;
  return RETURN_SERVICE_CODES.includes(serviceCode);
}

export function isClsStepType(
  stepType: StepTypeEnum | null | undefined,
): boolean {
  return !!stepType && CLS_STEP_TYPE_SET.has(stepType);
}

export function isStepSatisfied(
  status: StepStatusEnum | null | undefined,
): boolean {
  return (
    status === StepStatusEnum.COMPLETED ||
    status === StepStatusEnum.DECLINED ||
    status === StepStatusEnum.CANCELLED
  );
}

function createdAtMs(step: FlowStepLike): number {
  if (!step.created_at) return 0;
  const ms = new Date(step.created_at).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function isParentStep(step: FlowStepLike): boolean {
  return !step.parent_step_id;
}

export function pickAnchorStep(
  steps: FlowStepLike[],
): FlowStepLike | undefined {
  const eligible = steps.filter((step) => {
    if (!isParentStep(step)) return false;
    if (step.step_status === StepStatusEnum.CANCELLED) return false;
    if (isReturnServiceCode(step.service_code)) return false;
    if (step.step_type === StepTypeEnum.DISPENSING) return false;
    return true;
  });

  eligible.sort((a, b) => createdAtMs(b) - createdAtMs(a));
  return eligible[0];
}

export function pickLatestReturnStep(
  steps: FlowStepLike[],
): FlowStepLike | undefined {
  const returns = steps.filter(
    (step) =>
      isParentStep(step) &&
      isReturnServiceCode(step.service_code) &&
      step.step_status !== StepStatusEnum.CANCELLED,
  );
  returns.sort((a, b) => createdAtMs(b) - createdAtMs(a));
  return returns[0];
}

/**
 * PENDING return → extend the same step behind new CLS.
 * IN_PROGRESS / COMPLETED return → create return #2; if #1 is IN_PROGRESS,
 * new payment/CLS may wait on that return.
 */
export function resolveReturnStepPlan(
  steps: FlowStepLike[],
  hasNewClsSteps: boolean,
): ReturnStepPlan {
  if (!hasNewClsSteps) {
    return { action: 'skip' };
  }

  const returns = steps
    .filter(
      (step) =>
        isParentStep(step) &&
        isReturnServiceCode(step.service_code) &&
        step.step_status !== StepStatusEnum.CANCELLED,
    )
    .sort((a, b) => createdAtMs(a) - createdAtMs(b));

  const pending = returns.find(
    (step) => step.step_status === StepStatusEnum.PENDING,
  );
  if (pending) {
    return {
      action: 'extend',
      returnStepId: pending.step_id,
      paymentAnchorId: pickAnchorStep(steps)?.step_id,
    };
  }

  const inProgress = [...returns]
    .reverse()
    .find((step) => step.step_status === StepStatusEnum.IN_PROGRESS);
  if (inProgress) {
    return {
      action: 'create',
      paymentAnchorId: inProgress.step_id,
    };
  }

  return {
    action: 'create',
    paymentAnchorId: pickAnchorStep(steps)?.step_id,
  };
}
