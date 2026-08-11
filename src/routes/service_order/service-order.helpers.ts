import { ClinicalRoomType, StepTypeEnum } from '@prisma/client';

/**
 * Model notes (SO + queue):
 * - Group / merge Service_Order by ClinicalRoomType (service.room_type), not ServiceTypeEnum.
 * - Order.type / Step.step_type are derived via roomTypeToStepType for storage / flow only.
 * - 1 SO = 1 physical room = 1 invoice = 1 queue (primary clinical step).
 * - N services in an SO => N clinical steps (1:1 service_code) + N details.
 * - PHARMACY orders never enter the clinical queue (dispensing / prescription flow owns them).
 */

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
