import { Module } from '@nestjs/common';
import { NumberingModule } from '../../common/numbering/numbering.module';
import { SayacModule } from '../sayac/sayac.module';
import { MuhasebeModule } from '../muhasebe/muhasebe.module';
import { TahakkukController } from './tahakkuk.controller';
import { TahakkukCommandService } from './tahakkuk.command.service';
import { TahakkukQueryService } from './tahakkuk.query.service';

@Module({
  // Tahakkuk numarasi BOSLUKSUZ seridir (mali denetim izi) — NumaraServisi
  // cagiranin transaction'i icinde calisir.
  // Fiş üretimi KOPYALANMAZ: `FisCommandServisi` buradan alınır ki denklik,
  // kapalı dönem yasağı ve numaralandırma tek yerde dursun (ADR-0017).
  imports: [NumberingModule, SayacModule, MuhasebeModule],
  controllers: [TahakkukController],
  providers: [TahakkukCommandService, TahakkukQueryService],
})
export class TahakkukModule {}
