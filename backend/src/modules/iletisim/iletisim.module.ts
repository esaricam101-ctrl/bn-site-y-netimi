import { Module } from '@nestjs/common';
import { IletisimController } from './iletisim.controller';
import { IletisimCommandServisi } from './iletisim.command.service';
import { IletisimQueryServisi } from './iletisim.query.service';
import { KayitSaglayicisi, MesajSaglayicisi } from './saglayici/mesaj-saglayici.port';

/**
 * İletişim modülü — WhatsApp Business · SMS · (ileride e-posta).
 *
 * ⚠️  SAĞLAYICI BİR PORTTUR. `MesajSaglayicisi` soyut sınıfı `KayitSaglayicisi`
 *     ile karşılanır: hiçbir yere mesaj GÖNDERMEZ, yalnızca kaydeder.
 *
 *     Gerçek entegrasyon (Meta Cloud API · Netgsm · İletimerkezi) ileride bu
 *     token'a yeni bir sağlayıcı bağlanarak eklenir; servis ve controller kodu
 *     DEĞİŞMEZ. Sağlayıcı doğrudan servise gömülseydi, entegrasyon günü bütün
 *     komut servisi yeniden yazılırdı.
 */
@Module({
  controllers: [IletisimController],
  providers: [
    IletisimCommandServisi,
    IletisimQueryServisi,
    { provide: MesajSaglayicisi, useClass: KayitSaglayicisi },
  ],
  exports: [IletisimQueryServisi],
})
export class IletisimModule {}
