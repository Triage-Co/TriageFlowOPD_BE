import { Test, TestingModule } from '@nestjs/testing';
import { CronService } from './cron.service';
import { PrismaService } from '../../shared/config/prisma.service';
import { QueueRebalanceService } from '../queue/queue-rebalance.service';
import { QueuePriorityService } from '../queue/queue-priority.service';
import { QueueService } from '../queue/queue.service';

describe('CronService', () => {
  let service: CronService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        CronService,
        { provide: PrismaService, useValue: {} },
        {
          provide: QueueRebalanceService,
          useValue: { detectAndSuggest: jest.fn().mockResolvedValue({ created: 0 }) },
        },
        {
          provide: QueuePriorityService,
          useValue: {
            activateDueAppointmentQueues: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: QueueService,
          useValue: { broadcastRoomUpdate: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<CronService>(CronService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('activates due appointment queues and broadcasts each room', async () => {
    const priority = module.get(QueuePriorityService) as {
      activateDueAppointmentQueues: jest.Mock;
    };
    const queue = module.get(QueueService) as {
      broadcastRoomUpdate: jest.Mock;
    };
    priority.activateDueAppointmentQueues.mockResolvedValue(['room-a', 'room-b']);

    const result = await service.activateDueAppointmentQueues();

    expect(result.activatedRooms).toBe(2);
    expect(queue.broadcastRoomUpdate).toHaveBeenCalledWith('room-a');
    expect(queue.broadcastRoomUpdate).toHaveBeenCalledWith('room-b');
  });
});
