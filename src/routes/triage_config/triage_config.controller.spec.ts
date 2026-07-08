import { Test, TestingModule } from '@nestjs/testing';
import { TriageConfigController } from './triage_config.controller';
import { TriageConfigService } from './triage_config.service';

describe('TriageConfigController', () => {
  let controller: TriageConfigController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TriageConfigController],
      providers: [TriageConfigService],
    }).compile();

    controller = module.get<TriageConfigController>(TriageConfigController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
