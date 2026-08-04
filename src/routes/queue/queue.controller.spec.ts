import { Test, TestingModule } from '@nestjs/testing';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { IsRoleGuard } from '../../shared/guards/is-role.guard';

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
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QueueController],
      providers: [
        {
          provide: QueueService,
          useValue: mockQueueService,
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
