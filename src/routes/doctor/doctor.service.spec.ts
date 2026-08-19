import { Test, TestingModule } from '@nestjs/testing';
import { DoctorService } from './doctor.service';
import { PrismaService } from '../../shared/config/prisma.service';
import { ClinicalRoomType } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('DoctorService', () => {
  let service: DoctorService;
  let prismaService: any;
  let staffRepository: any;

  const mockSpecialty = {
    specialty_id: 'spec-123',
    specialty_code: 'SP_1',
    specialty_name: 'Chuyên khoa Mắt',
  };

  const mockDoctor = {
    staff_id: 'doctor-1',
    full_name: 'BS Lê Thị Kim',
    specialty_id: 'spec-123',
    account: {
      user_name: 'kimle',
      email: 'lethikim.mat@gmail.com',
    },
    specialty: {
      specialty_id: 'spec-123',
      specialty_name: 'Chuyên khoa Mắt',
      specialty_code: 'SP_1',
    },
    shifts: [
      {
        date: '2026-08-07',
        slots: [
          {
            slot_id: 'slot-1',
            start_time: '08:00',
            end_time: '08:30',
            status: 'AVAILABLE',
          },
        ],
      },
    ],
  };

  beforeEach(async () => {
    prismaService = {
      staff: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      slot: {
        findMany: jest.fn(),
      },
      specialty: {
        findFirst: jest.fn(),
      },
      shift: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      step: {},
      queue: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    staffRepository = {
      findDoctorsBySpecialtyAndDate: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DoctorService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: 'IStaffRepository',
          useValue: staffRepository,
        },
      ],
    }).compile();

    service = module.get<DoctorService>(DoctorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllClinicalDoctorsWithSpecialCode', () => {
    it('should throw NotFoundException if specialty does not exist', async () => {
      prismaService.specialty.findFirst.mockResolvedValue(null);

      await expect(
        service.findAllClinicalDoctorsWithSpecialCode('UNKNOWN_CODE', '2026-08-07'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if dateTimeStr is invalid', async () => {
      prismaService.specialty.findFirst.mockResolvedValue(mockSpecialty);

      await expect(
        service.findAllClinicalDoctorsWithSpecialCode('SP_1', 'invalid-date'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should call staffRepository with ClinicalRoomType.CLINICAL_ROOM and return data', async () => {
      prismaService.specialty.findFirst.mockResolvedValue(mockSpecialty);
      staffRepository.findDoctorsBySpecialtyAndDate.mockResolvedValue([mockDoctor]);

      const result = await service.findAllClinicalDoctorsWithSpecialCode(
        'SP_1',
        '2026-08-07',
      );

      expect(prismaService.specialty.findFirst).toHaveBeenCalledWith({
        where: {
          specialty_code: {
            equals: 'SP_1',
            mode: 'insensitive',
          },
        },
      });

      expect(staffRepository.findDoctorsBySpecialtyAndDate).toHaveBeenCalledWith(
        'spec-123',
        expect.any(Date),
        expect.any(Date),
        ClinicalRoomType.CLINICAL_ROOM,
      );

      expect(result).toEqual({
        code: 200,
        message: 'Lấy danh sách bác sĩ thành công',
        status: 'success',
        data: [mockDoctor],
      });
    });

    it('should throw NotFoundException if no clinical doctors found', async () => {
      prismaService.specialty.findFirst.mockResolvedValue(mockSpecialty);
      staffRepository.findDoctorsBySpecialtyAndDate.mockResolvedValue([]);

      await expect(
        service.findAllClinicalDoctorsWithSpecialCode('SP_1', '2026-08-07'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAllWithSpecialCode', () => {
    it('should call staffRepository without roomType filter', async () => {
      prismaService.specialty.findFirst.mockResolvedValue(mockSpecialty);
      staffRepository.findDoctorsBySpecialtyAndDate.mockResolvedValue([mockDoctor]);

      const result = await service.findAllWithSpecialCode('SP_1', '2026-08-07');

      expect(staffRepository.findDoctorsBySpecialtyAndDate).toHaveBeenCalledWith(
        'spec-123',
        expect.any(Date),
        expect.any(Date),
      );

      expect(result.data).toEqual([mockDoctor]);
    });
  });
});
