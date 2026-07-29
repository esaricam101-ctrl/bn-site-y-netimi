import { Module } from '@nestjs/common';
import { NumberingModule } from '../../common/numbering/numbering.module';
import { TahakkukController } from './tahakkuk.controller';
import { TahakkukCommandService } from './tahakkuk.command.service';
import { TahakkukQueryService } from './tahakkuk.query.service';

@Module({
  // Tahakkuk numarasi BOSLUKSUZ seridir (mali denetim izi) — NumaraServisi
  // cagiranin transaction'i icinde calisir.
  imports: [NumberingModule],
  controllers: [TahakkukController],
  providers: [TahakkukCommandService, TahakkukQueryService],
})
export class TahakkukModule {}
