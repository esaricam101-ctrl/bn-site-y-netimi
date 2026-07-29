import { Module } from '@nestjs/common';
import { KonutCalisaniController } from './konut-calisani.controller';
import { KonutCalisaniServisi } from './konut-calisani.service';

@Module({
  controllers: [KonutCalisaniController],
  providers: [KonutCalisaniServisi],
})
export class KonutCalisaniModule {}
