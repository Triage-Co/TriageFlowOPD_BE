import { Test, TestingModule } from '@nestjs/testing';
import { CronService } from './cron.service';
import { PrismaService } from '../../shared/config/prisma.service';
import { QueueRebalanceService } from '../queue/queue-rebalance.service';

describe('CronService', () => {
  let service: CronService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CronService,
        { provide: PrismaService, useValue: {} },
        {
          provide: QueueRebalanceService,
          useValue: { detectAndSuggest: jest.fn().mockResolvedValue({ created: 0 }) },
        },
      ],
    }).compile();

    service = module.get<CronService>(CronService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
