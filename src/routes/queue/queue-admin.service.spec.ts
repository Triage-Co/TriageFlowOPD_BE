import { BadRequestException } from '@nestjs/common';
import {
  QueueRuleTypeEnum,
  RebalanceSuggestionStatusEnum,
} from '@prisma/client';
import {
  QueueAdminService,
  validateConditions,
  validateParams,
} from './queue-admin.service';
import { mergeRebalanceParams } from './queue.constants';

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

describe('mergeRebalanceParams', () => {
  it('preserves eta_gap_minutes and suggestion_ttl_minutes when only enabled changes', () => {
    const merged = mergeRebalanceParams(
      { eta_gap_minutes: 20, enabled: true, suggestion_ttl_minutes: 8, extra: 1 },
      { enabled: false },
    );
    expect(merged.enabled).toBe(false);
    expect(merged.eta_gap_minutes).toBe(20);
    expect(merged.suggestion_ttl_minutes).toBe(8);
    expect(merged.extra).toBe(1);
  });

  it('fills defaults when existing params are missing', () => {
    const merged = mergeRebalanceParams(null, { enabled: true });
    expect(merged).toMatchObject({
      enabled: true,
      eta_gap_minutes: 15,
      suggestion_ttl_minutes: 10,
    });
  });
});

describe('QueueAdminService rebalance-config', () => {
  const prisma = {
    queue_Priority_Rule: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    queue_Rebalance_Suggestion: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const queuePriorityService = { clearRulesCache: jest.fn() };
  const queueEtaService = {};
  const queueGateway = { emitRebalanceResolved: jest.fn() };

  let service: QueueAdminService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.queue_Rebalance_Suggestion.findMany.mockResolvedValue([]);
    prisma.queue_Rebalance_Suggestion.updateMany.mockResolvedValue({ count: 0 });
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
    service = new QueueAdminService(
      prisma as never,
      queuePriorityService as never,
      queueEtaService as never,
      queueGateway as never,
    );
  });

  it('getRebalanceConfig returns defaults when no rule exists', async () => {
    prisma.queue_Priority_Rule.findFirst.mockResolvedValue(null);

    const res = await service.getRebalanceConfig();

    expect(res.data).toMatchObject({
      enabled: true,
      eta_gap_minutes: 15,
      suggestion_ttl_minutes: 10,
      rule_id: null,
    });
  });

  it('creates REBALANCE_DEFAULT when toggling with no existing rule', async () => {
    prisma.queue_Priority_Rule.findFirst.mockResolvedValue(null);
    prisma.queue_Priority_Rule.create.mockResolvedValue({
      rule_id: 'new-id',
      params: {
        enabled: false,
        eta_gap_minutes: 15,
        suggestion_ttl_minutes: 10,
      },
    });

    const res = await service.updateRebalanceConfig({ enabled: false });

    expect(prisma.queue_Priority_Rule.create).toHaveBeenCalled();
    expect(prisma.queue_Priority_Rule.create.mock.calls[0][0].data.rule_code).toBe(
      'REBALANCE_DEFAULT',
    );
    expect(queuePriorityService.clearRulesCache).toHaveBeenCalled();
    expect(res.data.enabled).toBe(false);
    expect(res.data.rule_id).toBe('new-id');
  });

  it('merges params and expires pending suggestions when disabling', async () => {
    prisma.queue_Priority_Rule.findFirst.mockResolvedValue({
      rule_id: 'rule-1',
      params: { enabled: true, eta_gap_minutes: 20, suggestion_ttl_minutes: 8 },
    });
    prisma.queue_Priority_Rule.update.mockResolvedValue({
      rule_id: 'rule-1',
      params: { enabled: false, eta_gap_minutes: 20, suggestion_ttl_minutes: 8 },
    });
    prisma.queue_Rebalance_Suggestion.findMany.mockResolvedValue([
      { suggestion_id: 's1', from_room_id: 'r1', to_room_id: 'r2' },
    ]);
    prisma.queue_Rebalance_Suggestion.updateMany.mockResolvedValue({ count: 1 });

    await service.updateRebalanceConfig({ enabled: false });

    expect(prisma.queue_Priority_Rule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { rule_id: 'rule-1' },
        data: expect.objectContaining({
          params: expect.objectContaining({
            enabled: false,
            eta_gap_minutes: 20,
            suggestion_ttl_minutes: 8,
          }),
        }),
      }),
    );
    expect(prisma.queue_Rebalance_Suggestion.updateMany).toHaveBeenCalledWith({
      where: { status: RebalanceSuggestionStatusEnum.PENDING },
      data: { status: RebalanceSuggestionStatusEnum.EXPIRED },
    });
    expect(queueGateway.emitRebalanceResolved).toHaveBeenCalledWith(
      'r1',
      'r2',
      expect.objectContaining({
        suggestion_id: 's1',
        status: RebalanceSuggestionStatusEnum.EXPIRED,
      }),
    );
  });

  it('does not expire suggestions when enabling', async () => {
    prisma.queue_Priority_Rule.findFirst.mockResolvedValue({
      rule_id: 'rule-1',
      params: { enabled: false, eta_gap_minutes: 15, suggestion_ttl_minutes: 10 },
    });
    prisma.queue_Priority_Rule.update.mockResolvedValue({
      rule_id: 'rule-1',
      params: { enabled: true, eta_gap_minutes: 15, suggestion_ttl_minutes: 10 },
    });

    await service.updateRebalanceConfig({ enabled: true });

    expect(prisma.queue_Rebalance_Suggestion.findMany).not.toHaveBeenCalled();
    expect(queueGateway.emitRebalanceResolved).not.toHaveBeenCalled();
  });
});
