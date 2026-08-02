import { Module } from '@nestjs/common';
import { MedicineModule } from './medicine/medicine.module';
import { PrescriptionModule } from './prescription/prescription.module';

@Module({
  imports: [MedicineModule, PrescriptionModule],
  exports: [MedicineModule, PrescriptionModule],
})
export class PharmacyModule {}
