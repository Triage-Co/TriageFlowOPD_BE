import { Test, TestingModule } from '@nestjs/testing';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { IsRoleGuard } from '../../shared/guards/is-role.guard';

import { QueueRebalanceService } from './queue-rebalance.service';

describe('QueueController', () => {
  let controller: QueueController;

  const mockQueueService = {
    callNextPatient: jest.fn(),
    transferQueue: jest.fn(),
    overrideQueuePosition: jest.fn(),
    markQueueMissed: jest.fn(),
    recallQueue: jest.fn(),
    getRoomQueueView: jest.fn(),
    updateRoomDefaultDurationSec: jest.fn(),
    getFlaggableRules: jest.fn(),
    updateQueueManualRuleCodes: jest.fn(),
  };

  const mockQueueRebalanceService = {
    getPendingSuggestions: jest.fn(),
    confirmSuggestion: jest.fn(),
    rejectSuggestion: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QueueController],
      providers: [
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
        {
          provide: QueueRebalanceService,
          useValue: mockQueueRebalanceService,
        },
      ],
    })
      .overrideGuard(IsAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(IsRoleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<QueueController>(QueueController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
