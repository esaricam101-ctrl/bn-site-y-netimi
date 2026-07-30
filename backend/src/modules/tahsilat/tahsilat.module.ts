import { Module } from '@nestjs/common';
import { MuhasebeModule } from '../muhasebe/muhasebe.module';
import { TahsilatController } from './tahsilat.controller';
import { TahsilatCommandServisi } from './tahsilat.command.service';
import { MakbuzQueryServisi } from './makbuz.query.service';

/**
 * Makbuz / Tahsilat modülü — CQRS ayrımı korunur:
 *   · `TahsilatCommandServisi` → yazma (tahsilat · iptal · muhasebeleştirme)
 *   · `MakbuzQueryServisi`     → okuma (makbuz geçmişi · detay · cari ekstre ·
 *                                yaşlandırma · kontrol mutabakatı)
 *
 * MuhasebeModule İÇE AKTARILIR: makbuzun muhasebeleştirilmesi
 * `FisCommandServisi` üzerinden fiş üretir. Fiş üretimi burada KOPYALANMADI —
 * dönem denetimi, çift kayıt denkliği, fiş no tahsisi ve audit zaten orada
 * yazılıdır.
 */
@Module({
  imports: [MuhasebeModule],
  controllers: [TahsilatController],
  providers: [TahsilatCommandServisi, MakbuzQueryServisi],
  exports: [MakbuzQueryServisi],
})
export class TahsilatModule {}
