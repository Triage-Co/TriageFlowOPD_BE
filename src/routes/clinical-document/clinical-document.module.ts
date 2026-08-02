import { Module } from '@nestjs/common';
import { ClinicalDocumentService } from './clinical-document.service';
import { ClinicalDocumentController } from './clinical-document.controller';

@Module({
  controllers: [ClinicalDocumentController],
  providers: [ClinicalDocumentService],
  exports: [ClinicalDocumentService],
})
export class ClinicalDocumentModule {}
