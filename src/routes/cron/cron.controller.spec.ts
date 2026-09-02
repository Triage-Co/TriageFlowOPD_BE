import { Test, TestingModule } from '@nestjs/testing';
import { CronController } from './cron.controller';
import { CronService } from './cron.service';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { IsRoleGuard } from '../../shared/guards/is-role.guard';

describe('CronController', () => {
  let controller: CronController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CronController],
      providers: [
        {
          provide: CronService,
          useValue: {
            updateFlowAndStepExpired: jest.fn(),
            updateTransactionStatus: jest.fn(),
            updatePrescriptionExpired: jest.fn(),
            handleRebalanceDetector: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(IsAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(IsRoleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CronController>(CronController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
