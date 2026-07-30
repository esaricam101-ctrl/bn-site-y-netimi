import { Module } from '@nestjs/common';
import { MuhasebeModule } from '../muhasebe/muhasebe.module';
import { BankaController } from './banka.controller';
import { BankaTanimServisi } from './banka-tanim.service';
import { BankaHareketCommandServisi } from './hareket.command.service';
import { BankaHareketQueryServisi } from './hareket.query.service';
import { EkstreServisi } from './ekstre.service';
import { KiymetliEvrakServisi } from './kiymetli-evrak.service';
import { BankaParametreServisi } from './banka-parametre.service';

/**
 * Banka modülü — CQRS ayrımı korunur:
 *   · `BankaTanimServisi` · `BankaHareketCommandServisi` · `EkstreServisi` ·
 *     `KiymetliEvrakServisi` · `BankaParametreServisi`  → yazma
 *   · `BankaHareketQueryServisi`                        → okuma
 *
 * MuhasebeModule İÇE AKTARILIR çünkü muhasebeleştirme `FisCommandServisi`
 * üzerinden fiş üretir. Fiş üretimi burada KOPYALANMADI: dönem denetimi, çift
 * kayıt denkliği, fiş no tahsisi ve audit zaten orada yazılıdır.
 */
@Module({
  imports: [MuhasebeModule],
  controllers: [BankaController],
  providers: [
    BankaTanimServisi,
    BankaHareketCommandServisi,
    BankaHareketQueryServisi,
    EkstreServisi,
    KiymetliEvrakServisi,
    BankaParametreServisi,
  ],
})
export class BankaModule {}
