import { Test, TestingModule } from '@nestjs/testing';
import { ServiceOrderController } from './service_order.controller';
import { ServiceOrderService } from './service_order.service';

describe('ServiceOrderController', () => {
  let controller: ServiceOrderController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServiceOrderController],
      providers: [ServiceOrderService],
    }).compile();

    controller = module.get<ServiceOrderController>(ServiceOrderController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
