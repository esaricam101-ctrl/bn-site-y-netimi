import { Module } from '@nestjs/common';
import { MuhasebeController } from './muhasebe.controller';
import { HesapPlaniServisi } from './hesap-plani.service';
import { FisCommandServisi } from './fis.command.service';
import { DefterQueryServisi } from './defter.query.service';
import { DonemServisi } from './donem.service';
import { ParametreServisi } from './parametre.service';

/**
 * Muhasebe modülü — CQRS ayrımı korunur:
 *   · `FisCommandServisi` · `DonemServisi` · `HesapPlaniServisi` → yazma
 *   · `DefterQueryServisi` → okuma (defter · mizan · muavin · fiş listesi)
 */
@Module({
  controllers: [MuhasebeController],
  providers: [
    HesapPlaniServisi,
    FisCommandServisi,
    DefterQueryServisi,
    DonemServisi,
    ParametreServisi,
  ],
})
export class MuhasebeModule {}
