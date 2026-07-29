import { Module } from '@nestjs/common';
import { AracController } from './arac.controller';
import { AracServisi } from './arac.service';

@Module({
  controllers: [AracController],
  providers: [AracServisi],
  // Tahakkuk KULLANIM_BAZLI dagitimda tarihte gecerli araclari okur.
  exports: [AracServisi],
})
export class AracModule {}
