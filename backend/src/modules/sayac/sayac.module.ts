import { Module } from '@nestjs/common';
import { SayacController } from './sayac.controller';
import { SayacServisi } from './sayac.service';

@Module({
  controllers: [SayacController],
  providers: [SayacServisi],
  // Tahakkuk TUKETIM kuralinda donem tuketimini buradan okur.
  exports: [SayacServisi],
})
export class SayacModule {}
