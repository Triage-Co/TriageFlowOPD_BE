import { Module } from '@nestjs/common';
import { DisplayScreenController } from './display-screen.controller';
import { DisplayScreenService } from './display-screen.service';
import { IsDisplayPinOrAdminGuard } from '../../shared/guards/is-display-pin-or-admin.guard';

@Module({
  controllers: [DisplayScreenController],
  providers: [DisplayScreenService, IsDisplayPinOrAdminGuard],
  exports: [DisplayScreenService],
})
export class DisplayScreenModule {}
