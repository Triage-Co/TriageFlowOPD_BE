import { Test, TestingModule } from '@nestjs/testing';
import { TriageConfigService } from './triage_config.service';

describe('TriageConfigService', () => {
  let service: TriageConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TriageConfigService],
    }).compile();

    service = module.get<TriageConfigService>(TriageConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
