/**
 * MESAJ SAĞLAYICI PORTU — WhatsApp Business API · SMS operatörü · SMTP.
 *
 * Uygulama katmanı hiçbir sağlayıcıyı DOĞRUDAN tanımaz; bu arayüzü tanır.
 * Gerçek entegrasyon (Meta Cloud API, Netgsm, İletimerkezi…) ileride bu
 * arayüzü uygulayan bir adaptör olarak eklenir ve servis kodu DEĞİŞMEZ.
 *
 * ⚠️  BU FAZDA GERÇEK SAĞLAYICI YOKTUR (kullanıcının kararı: "altyapı ve
 *     modüller hazır olsun, gerçek API bağlantıları sonraki fazda").
 */
import { Injectable, Logger } from '@nestjs/common';

export interface GonderimIstegi {
  readonly kanal: 'WHATSAPP' | 'SMS' | 'EPOSTA';
  readonly numara: string;
  readonly govde: string;
  readonly mesajId: string;
}

export interface GonderimYaniti {
  /** Sağlayıcı mesajı kabul etti mi. */
  readonly kabulEdildi: boolean;
  readonly saglayici: string;
  readonly saglayiciMesajId: string | null;
  readonly hataKodu: string | null;
  readonly hataMesaji: string | null;
}

export abstract class MesajSaglayicisi {
  abstract readonly ad: string;
  /** Sağlayıcı gerçekten mesaj gönderebiliyor mu. */
  abstract readonly etkinMi: boolean;
  abstract gonder(istek: GonderimIstegi): Promise<GonderimYaniti>;
}

/**
 * KAYIT SAĞLAYICISI — hiçbir yere mesaj GÖNDERMEZ, yalnızca kaydeder.
 *
 * ⚠️  BU ADAPTÖR HİÇBİR MESAJI "GÖNDERİLDİ" SAYMAZ. `kabulEdildi: false`
 *     döner ve mesaj `SAGLAYICI_YOK` durumunda kalır.
 *
 *     Sahte bir başarı dönseydi hata SESSİZ olurdu: yönetici 400 daireye
 *     aidat hatırlatması gönderdiğini sanır, sistem "teslim edildi" gösterir,
 *     kimse mesaj almaz ve bu ancak icra takibi aşamasında — aylar sonra —
 *     anlaşılırdı. Gönderilmemiş bir bildirimin "gönderildi" görünmesi,
 *     tebligat yerine geçtiği sanılabilecek bir yanlıştır.
 *
 * ⚠️  `SAGLAYICI_YOK` bir HATA DEĞİL, YAPILANDIRMA EKSİĞİDİR ve durum
 *     raporunda ayrı sayılır; "başarısız" sayılsaydı gerçek operatör hata
 *     oranı okunamazdı.
 */
@Injectable()
export class KayitSaglayicisi extends MesajSaglayicisi {
  private readonly logger = new Logger('MesajSaglayici');
  override readonly ad = 'kayit';
  override readonly etkinMi = false;

  override gonder(istek: GonderimIstegi): Promise<GonderimYaniti> {
    this.logger.log(
      `[SAGLAYICI YOK] ${istek.kanal} → ${istek.numara} · mesaj ${istek.mesajId} ` +
        `(${istek.govde.length} karakter) — kaydedildi, GÖNDERİLMEDİ.`,
    );
    return Promise.resolve({
      kabulEdildi: false,
      saglayici: this.ad,
      saglayiciMesajId: null,
      hataKodu: 'SAGLAYICI_YOK',
      hataMesaji:
        'Gerçek mesaj sağlayıcısı tanımlı değil. Mesaj kaydedildi ama ' +
        'GÖNDERİLMEDİ; sağlayıcı bağlandığında yeniden kuyruğa alınabilir.',
    });
  }
}
