import { BadRequestException } from '@nestjs/common';
import { QueueRuleTypeEnum } from '@prisma/client';
import { validateConditions, validateParams } from './queue-admin.service';

describe('QueueAdminService Pure Validators', () => {
  describe('validateConditions', () => {
    it('should pass for valid conditions', () => {
      expect(() =>
        validateConditions({ age: { lt: 6 }, gender: { eq: 'MALE' } }),
      ).not.toThrow();
    });

    it('should throw BadRequestException for unsupported condition field', () => {
      expect(() =>
        validateConditions({ unknown_field: { eq: 10 } }),
      ).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for unsupported operator', () => {
      expect(() =>
        validateConditions({ age: { regex: '.*' } }),
      ).toThrow(BadRequestException);
    });
  });

  describe('validateParams', () => {
    it('should pass for valid MISSED_TURN params', () => {
      expect(() =>
        validateParams(QueueRuleTypeEnum.MISSED_TURN, { hold_positions: 3 }),
      ).not.toThrow();
    });

    it('should throw for invalid MISSED_TURN params', () => {
      expect(() =>
        validateParams(QueueRuleTypeEnum.MISSED_TURN, { hold_positions: 0 }),
      ).toThrow(BadRequestException);
      expect(() =>
        validateParams(QueueRuleTypeEnum.MISSED_TURN, {}),
      ).toThrow(BadRequestException);
    });

    it('should pass for valid REBALANCE params', () => {
      expect(() =>
        validateParams(QueueRuleTypeEnum.REBALANCE, { eta_gap_minutes: 15 }),
      ).not.toThrow();
    });

    it('should throw for invalid REBALANCE params', () => {
      expect(() =>
        validateParams(QueueRuleTypeEnum.REBALANCE, { eta_gap_minutes: -5 }),
      ).toThrow(BadRequestException);
    });
  });
});
