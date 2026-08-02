import { Test, TestingModule } from '@nestjs/testing';
import { VnptService } from './vnpt.service';

describe('VnptService', () => {
  let service: VnptService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VnptService],
    }).compile();

    service = module.get<VnptService>(VnptService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
