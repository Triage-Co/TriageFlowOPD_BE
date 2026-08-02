import { Test, TestingModule } from '@nestjs/testing';
import { VnptController } from './vnpt.controller';
import { VnptService } from './vnpt.service';

describe('VnptController', () => {
  let controller: VnptController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VnptController],
      providers: [VnptService],
    }).compile();

    controller = module.get<VnptController>(VnptController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
