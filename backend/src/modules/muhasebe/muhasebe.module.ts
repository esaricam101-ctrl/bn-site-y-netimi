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
  // Banka modülü hareketi muhasebeleştirirken fiş üretimini KOPYALAMAZ, bunu
  // çağırır. Dönem denetimi · çift kayıt denkliği · fiş no tahsisi · audit
  // yalnızca burada yazılıdır.
  exports: [FisCommandServisi],
})
export class MuhasebeModule {}
