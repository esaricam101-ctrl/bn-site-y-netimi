import { Module } from '@nestjs/common';
import { DaireGorevlisiController } from './daire-gorevlisi.controller';
import { DaireGorevlisiServisi } from './daire-gorevlisi.service';

@Module({
  controllers: [DaireGorevlisiController],
  providers: [DaireGorevlisiServisi],
})
export class DaireGorevlisiModule {}
