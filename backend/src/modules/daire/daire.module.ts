import { Module } from '@nestjs/common';
import { BolumModule } from '../bolum/bolum.module';
import { MalikModule } from '../malik/malik.module';
import { KiraciModule } from '../kiraci/kiraci.module';
import { SakinModule } from '../sakin/sakin.module';
import { DaireController } from './daire.controller';
import { DaireQueryService } from './daire.query.service';

/**
 * Daire okuma modeli — yeni varlık tanımlamaz.
 *
 * Yalnızca Query tarafı vardır: yazma işlemleri kendi modüllerinde kalır
 * (bölüm · malik · kiracı · sakin). Bu modül onların query servislerini
 * birleştirir; satır eşleme mantığı kopyalanmaz.
 */
@Module({
  imports: [BolumModule, MalikModule, KiraciModule, SakinModule],
  controllers: [DaireController],
  providers: [DaireQueryService],
})
export class DaireModule {}
