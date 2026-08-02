import { Test, TestingModule } from '@nestjs/testing';
import { ServiceOrderDetailService } from './service_order_detail.service';

describe('ServiceOrderDetailService', () => {
  let service: ServiceOrderDetailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ServiceOrderDetailService],
    }).compile();

    service = module.get<ServiceOrderDetailService>(ServiceOrderDetailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
