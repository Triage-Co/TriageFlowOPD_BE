import { Test, TestingModule } from '@nestjs/testing';
import { ServiceOrderDetailController } from './service_order_detail.controller';
import { ServiceOrderDetailService } from './service_order_detail.service';

describe('ServiceOrderDetailController', () => {
  let controller: ServiceOrderDetailController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServiceOrderDetailController],
      providers: [ServiceOrderDetailService],
    }).compile();

    controller = module.get<ServiceOrderDetailController>(ServiceOrderDetailController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
