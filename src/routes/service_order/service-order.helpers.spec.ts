import { ClinicalRoomType, StepTypeEnum } from '@prisma/client';
import {
  isPharmacyRoomType,
  roomTypeToStepType,
} from './service-order.helpers';

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
});
