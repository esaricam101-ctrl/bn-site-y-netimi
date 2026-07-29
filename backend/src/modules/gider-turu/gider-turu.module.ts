import { Module } from '@nestjs/common';
import { GiderTuruController } from './gider-turu.controller';
import { GiderTuruCommandService } from './gider-turu.command.service';
import { GiderTuruQueryService } from './gider-turu.query.service';

@Module({
  controllers: [GiderTuruController],
  providers: [GiderTuruCommandService, GiderTuruQueryService],
  // Tahakkuk modulu kurallari okumak icin Query servisini kullanir.
  exports: [GiderTuruQueryService],
})
export class GiderTuruModule {}
