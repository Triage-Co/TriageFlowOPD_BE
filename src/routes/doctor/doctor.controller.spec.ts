import { Test, TestingModule } from '@nestjs/testing';
import { DoctorController } from './doctor.controller';
import { DoctorService } from './doctor.service';

describe('DoctorController', () => {
  let controller: DoctorController;
  let doctorService: any;

  beforeEach(async () => {
    doctorService = {
      findAllClinicalDoctorsWithSpecialCode: jest.fn(),
      findAllWithSpecialCode: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      findOneWithSlotAndDate: jest.fn(),
      getPatients: jest.fn(),
      getPatientByQueueId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DoctorController],
      providers: [
        {
          provide: DoctorService,
          useValue: doctorService,
        },
      ],
    }).compile();

    controller = module.get<DoctorController>(DoctorController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call doctorService.findAllClinicalDoctorsWithSpecialCode', async () => {
    const expectedResult = {
      code: 200,
      message: 'Lấy danh sách bác sĩ thành công',
      status: 'success',
      data: [],
    };
    doctorService.findAllClinicalDoctorsWithSpecialCode.mockResolvedValue(expectedResult);

    const result = await controller.findAllClinicalWithSpecialCode('SP_1', '2026-08-07');

    expect(doctorService.findAllClinicalDoctorsWithSpecialCode).toHaveBeenCalledWith(
      'SP_1',
      '2026-08-07',
    );
    expect(result).toBe(expectedResult);
  });
});
