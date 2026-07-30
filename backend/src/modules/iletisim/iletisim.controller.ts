import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Principal } from '@bnos/kernel';
import { IZINLER } from '@bnos/core-domain';
import { AktifPrincipal, RequirePermission } from '../../common/decorators';
import {
  IletisimCommandServisi, type GonderimSonucu,
} from './iletisim.command.service';
import {
  IletisimQueryServisi,
  type DurumRaporu, type GonderimSatiri, type MesajSatiri, type SablonSatiri,
} from './iletisim.query.service';
import { MesajSaglayicisi } from './saglayici/mesaj-saglayici.port';
import {
  GonderimIptalDto, GonderimOlusturDto, IzinKaydetDto, KuralKaydetDto,
  SablonDuzeltDto, SablonEkleDto, SilDto,
} from './dto/iletisim.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';
import { KANALLAR } from './dto/iletisim.dto';

/** Mesaj durumları — sorgu süzgeci için geçerli değerler. */
const DURUMLAR = [
  'BEKLIYOR', 'KUYRUKTA', 'GONDERILDI', 'TESLIM_EDILDI', 'OKUNDU',
  'BASARISIZ', 'IPTAL', 'SAGLAYICI_YOK', 'IZIN_YOK',
] as const;

/**
 * Sorgu parametresini GEÇERLİ DEĞERLER KÜMESİNE daraltır.
 *
 * ⚠️  Ham metin doğrudan Prisma'ya verilseydi `?kanal=XYZ` gibi bir istek
 *     veritabanı düzeyinde patlar ve kullanıcı 500 görürdü. Tip zorlaması
 *     (`as`) da aynı sonucu verir — yalnızca derleyiciyi susturur.
 *     Tanınmayan değer YOK SAYILIR: süzgeç uygulanmaz, liste tam döner.
 */
function daralt<T extends string>(
  deger: string | undefined, gecerliler: readonly T[],
): T | undefined {
  if (deger === undefined) return undefined;
  return gecerliler.find((g) => g === deger);
}

/**
 * İLETİŞİM — WhatsApp Business · SMS · (ileride e-posta).
 *
 * ⚠️  TEK MODÜL, KANAL BİR ALANDIR. WhatsApp ve SMS ayrı modüller olsaydı
 *     alıcı çözümü (site · blok · kat · daire · rol · kişi), şablonlar, toplu
 *     ve zamanlanmış gönderim, geçmiş, durum takibi ve İYS izin denetimi İKİ
 *     KEZ yazılırdı; biri düzeltildiğinde öteki sessizce eski davranırdı.
 *
 * ⚠️  BU FAZDA HİÇBİR MESAJ GERÇEKTEN GÖNDERİLMEZ. Sağlayıcı portu hazır,
 *     gerçek adaptör yok; mesajlar `SAGLAYICI_YOK` durumunda kalır ve bu
 *     durum yanıtlarda AÇIKÇA döner. Sahte bir "gönderildi", yöneticinin
 *     sakinleri bilgilendirdiğini sanmasına yol açardı.
 *
 * YETKİLER — DÖRT AYRI İZİN, tek "iletisim.manage" değil:
 *   · `ILETI_GONDER`        → tekil gönderim · şablon okuma · geçmiş
 *   · `ILETI_TOPLU_GONDER`  → çok alıcılı hedefler (GERİ ALINAMAZ: gönderilen
 *                             mesaj geri çağrılamaz)
 *   · `ILETI_BELGE_PAYLAS`  → belge ekli gönderim (KVKK: gizlilik seviyesi
 *                             olan dosyayı dışarı çıkarır)
 *   · `ILETI_AYAR`          → şablon/kural/izin yönetimi
 */
@ApiTags('İletişim')
@ApiBearerAuth()
@Controller('iletisim')
export class IletisimController {
  constructor(
    private readonly komut: IletisimCommandServisi,
    private readonly sorgu: IletisimQueryServisi,
    private readonly saglayici: MesajSaglayicisi,
  ) {}

  /* -------------------------------- Durum -------------------------------- */

  @Get('saglayici')
  @RequirePermission(IZINLER.ILETI_GONDER)
  @ApiOperation({
    summary: 'Sağlayıcı durumu',
    description:
      '`etkinMi = false` ise hiçbir mesaj GÖNDERİLMEZ; kayıtlar oluşur ve ' +
      '`SAGLAYICI_YOK` durumunda kalır. Bu bilgi arayüzde GİZLENMEMELİDİR.',
  })
  saglayiciDurumu(): { readonly ad: string; readonly etkinMi: boolean } {
    return { ad: this.saglayici.ad, etkinMi: this.saglayici.etkinMi };
  }

  /* -------------------------------- Şablon ------------------------------- */

  @Get('sablonlar')
  @RequirePermission(IZINLER.ILETI_GONDER)
  @ApiQuery({ name: 'kanal', required: false, example: 'SMS' })
  @ApiOperation({
    summary: 'Mesaj şablonları',
    description:
      'Kanal süzgeci verilirse o kanala özel VE kanalsız (her kanalda ' +
      'kullanılabilir) şablonlar döner.',
  })
  sablonlar(
    @AktifPrincipal() principal: Principal,
    @Query('kanal') kanal?: string,
  ): Promise<readonly SablonSatiri[]> {
    return this.sorgu.sablonlar(principal, daralt(kanal, KANALLAR));
  }

  @Post('sablonlar')
  @RequirePermission(IZINLER.ILETI_AYAR)
  @ApiOperation({
    summary: 'Şablon ekle',
    description:
      'Değişkenler `{{ad}}` biçimindedir. ÇÖZÜLMEYEN DEĞİŞKEN GÖNDERİMİ ' +
      'ENGELLER: ham `{{ad}}` metninin ya da boş bırakılmış bir cümlenin ' +
      'gitmesi yönetime olan güveni tek seferde bitirir.',
  })
  sablonEkle(
    @Body() dto: SablonEkleDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.komut.sablonEkle(dto, principal);
  }

  @Patch('sablonlar/:id')
  @RequirePermission(IZINLER.ILETI_AYAR)
  @ApiOperation({
    summary: 'Şablon düzelt — KOD ve KANAL değiştirilemez',
    description:
      'Kod değişirse otomatik bildirim kuralları kopar. Kanal değişirse SMS ' +
      'için yazılmış kısa metin WhatsApp\'a, uzun metin SMS\'e geçer ve ' +
      'kontör sessizce artar.',
  })
  sablonDuzelt(
    @Param('id') id: string,
    @Body() dto: SablonDuzeltDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.komut.sablonDuzelt(id, dto, principal);
  }

  @Delete('sablonlar/:id')
  @RequirePermission(IZINLER.ILETI_AYAR)
  @ApiOperation({
    summary: 'Şablonu arşivle',
    description:
      'KULLANILMIŞ ŞABLON ARŞİVLENEMEZ: geçmiş gönderimler ona bağlıdır ve ' +
      'silinirse "bu mesaj hangi şablondan üretildi" sorusu cevapsız kalır.',
  })
  sablonSil(
    @Param('id') id: string,
    @Body() dto: SilDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.komut.sablonSil(id, dto.gerekce, principal);
  }

  /* ------------------------------- Gönderim ------------------------------ */

  @Get('gonderimler')
  @RequirePermission(IZINLER.ILETI_GONDER)
  @ApiQuery({ name: 'kanal', required: false })
  @ApiOperation({ summary: 'Gönderim listesi (parti bazında)' })
  gonderimler(
    @AktifPrincipal() principal: Principal,
    @Query('kanal') kanal?: string,
  ): Promise<readonly GonderimSatiri[]> {
    return this.sorgu.gonderimler(principal, daralt(kanal, KANALLAR));
  }

  @Post('gonderimler')
  @RequirePermission(IZINLER.ILETI_TOPLU_GONDER)
  @ApiOperation({
    summary: 'Gönderim oluştur (tekil ya da toplu)',
    description:
      'Hedef: Tüm Site · Blok · Kat · Daire · Malik · Kiracı · Sakin · Daire ' +
      'Görevlisi · Yönetim Kurulu · Belirli Kişiler.\n\n' +
      '⚠️  İZİNSİZ ALICI ATLANMAZ, `IZIN_YOK` durumuyla KAYDEDİLİR. Atlansaydı ' +
      '"500 kişiye gönderdim" denir ama 80\'ine gitmediği hiçbir yerde ' +
      'görünmezdi.\n\n' +
      '⚠️  NUMARASI OLMAYAN ya da ŞABLONU ÇÖZÜLEMEYEN alıcı da `BASARISIZ` ' +
      'olarak kaydedilir — sessizce düşürülmez.\n\n' +
      '⚠️  AYNI KİŞİ TEKİLLEŞTİRİLİR: hem malik hem sakin olan kişi duyuruyu ' +
      'iki kez almaz (ve iki kontör düşmez).\n\n' +
      '⚠️  SAĞLAYICI YOKKEN mesajlar `SAGLAYICI_YOK` kalır; yanıttaki ' +
      '`saglayiciEtkinMi` ve `uyarilar` bunu açıkça söyler.\n\n' +
      '⚠️  GRUP hedefi DESTEKLENMİYOR (sistemde grup kavramı yok) ve boş liste ' +
      'yerine AÇIK HATA döner.',
  })
  gonderimOlustur(
    @Body() dto: GonderimOlusturDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<GonderimSonucu> {
    return this.komut.gonderimOlustur(dto, principal);
  }

  @Post('gonderimler/:id/iptal')
  @RequirePermission(IZINLER.ILETI_TOPLU_GONDER)
  @ApiOperation({
    summary: 'Gönderimi iptal et',
    description:
      '⚠️  GÖNDERİLMİŞ MESAJ GERİ ÇAĞRILAMAZ. Yalnızca henüz gönderilmemiş ' +
      'mesajlar iptal edilir; iptal, gidenleri geri getirmez.',
  })
  gonderimIptal(
    @Param('id') id: string,
    @Body() dto: GonderimIptalDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.komut.gonderimIptal(id, dto, principal);
  }

  /* -------------------------------- Mesaj -------------------------------- */

  @Get('mesajlar')
  @RequirePermission(IZINLER.ILETI_GONDER)
  @ApiQuery({ name: 'kanal', required: false })
  @ApiQuery({ name: 'durum', required: false })
  @ApiQuery({ name: 'baslangic', required: false })
  @ApiQuery({ name: 'bitis', required: false })
  @ApiQuery({ name: 'kisiId', required: false })
  @ApiQuery({ name: 'arama', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOperation({
    summary: 'Mesaj geçmişi — "Son Gönderilenler" ve "Geçmiş" AYNI UÇTUR',
    description:
      'Kanal süzgeci `SMS` verilirse "Son Gönderilen SMS\'ler", `WHATSAPP` ' +
      'verilirse WhatsApp geçmişi olur. Ayrı uçlar olsaydı iki ekran iki ' +
      'farklı sayı gösterebilirdi.\n\n' +
      '⚠️  BAŞARISIZ ve İZİN_YOK mesajlar LİSTEDE KALIR. Süzülselerdi "kime ' +
      'gitmedi" sorusu yanıtsız kalır ve yönetici herkese ulaştığını sanardı.\n\n' +
      'Arama alıcı adı · numara · mesaj metni üzerinde çalışır.',
  })
  mesajlar(
    @AktifPrincipal() principal: Principal,
    @Query('kanal') kanal?: string,
    @Query('durum') durum?: string,
    @Query('baslangic') baslangic?: string,
    @Query('bitis') bitis?: string,
    @Query('kisiId') kisiId?: string,
    @Query('arama') arama?: string,
    @Query('limit') limit?: string,
  ): Promise<readonly MesajSatiri[]> {
    const n = limit === undefined ? 100 : Number.parseInt(limit, 10);
    return this.sorgu.mesajlar(principal, {
      ...(daralt(kanal, KANALLAR) === undefined ? {} : { kanal: daralt(kanal, KANALLAR) }),
      ...(daralt(durum, DURUMLAR) === undefined ? {} : { durum: daralt(durum, DURUMLAR) }),
      ...(baslangic ? { baslangic } : {}),
      ...(bitis ? { bitis } : {}),
      ...(kisiId ? { kisiId } : {}),
      ...(arama ? { arama } : {}),
      limit: Number.isFinite(n) && n > 0 && n <= 500 ? n : 100,
    });
  }

  @Get('mesajlar/:id')
  @RequirePermission(IZINLER.ILETI_GONDER)
  @ApiOperation({ summary: 'Mesaj detayı — tam metin' })
  mesajDetayi(
    @Param('id') id: string,
    @AktifPrincipal() principal: Principal,
  ): ReturnType<IletisimQueryServisi['mesajDetayi']> {
    return this.sorgu.mesajDetayi(id, principal);
  }

  @Post('mesajlar/:id/yeniden-gonder')
  @RequirePermission(IZINLER.ILETI_GONDER)
  @ApiOperation({
    summary: 'Yeniden gönder',
    description:
      'Yalnızca BASARISIZ ve SAGLAYICI_YOK durumundaki mesajlar yeniden ' +
      'denenebilir. Teslim edilmiş bir mesajın tekrarı alıcıya aynı bildirimi ' +
      'iki kez gönderir.\n\n' +
      '⚠️  AZAMİ DENEME SINIRLIDIR (3): sürekli başarısız olan numara ' +
      'muhtemelen geçersizdir ve sınırsız deneme kontör tüketir.',
  })
  yenidenGonder(
    @Param('id') id: string,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.komut.mesajYenidenGonder(id, principal);
  }

  /* ----------------------------- Durum raporu ---------------------------- */

  @Get('rapor/durum')
  @RequirePermission(IZINLER.ILETI_GONDER)
  @ApiQuery({ name: 'kanal', required: false })
  @ApiOperation({
    summary: 'Durum Raporu — sayılar ve grafik serileri',
    description:
      'Toplam · Başarılı · Başarısız · Bekleyen · İptal · Sağlayıcı yok · ' +
      'İzin yok · Kontör · Başarı oranı · Son gönderim · Günlük/aylık sayı · ' +
      'son 30 gün serisi · durum dağılımı.\n\n' +
      '⚠️  BAŞARI ORANI PAYDASI "denenen" mesajlardır. Toplam üzerinden ' +
      'hesaplansaydı, izin yokluğundan hiç denenmemiş mesajlar oranı aşağı ' +
      'çeker ve sağlayıcı sağlıklıyken "hata oranı yüksek" sanılırdı. Hiç ' +
      'denenmemişse `null` döner — `0` DEĞİL, çünkü "hiç gönderim yok" ile ' +
      '"hepsi başarısız" aynı şey değildir.\n\n' +
      '⚠️  `SAGLAYICI_YOK` ve `IZIN_YOK` AYRI sayılır; "başarısız"a ' +
      'karıştırılsaydı gerçek operatör hata oranı okunamazdı.',
  })
  durumRaporu(
    @AktifPrincipal() principal: Principal,
    @Query('kanal') kanal?: string,
  ): Promise<DurumRaporu> {
    return this.sorgu.durumRaporu(principal, daralt(kanal, KANALLAR), this.saglayici.etkinMi);
  }

  /* --------------------------------- İzin -------------------------------- */

  @Post('izinler')
  @RequirePermission(IZINLER.ILETI_AYAR)
  @ApiOperation({
    summary: 'İletişim izni kaydet (İYS)',
    description:
      '⚠️  ÜÇ DURUM VARDIR, İKİ DEĞİL:\n' +
      '· RET → o kanalda BİLGİLENDİRME dahil hiçbir şey gönderilmez\n' +
      '· İzin kaydı YOK → bilgilendirme gider, TİCARİ gitmez\n' +
      '· İZİN → ikisi de gider\n\n' +
      'Tek bayrağa indirgenseydi ya bütün bildirimler izne takılır (aidat ' +
      'borcu haber verilemez) ya da ticari ileti izinsiz giderdi — ikincisi ' +
      'idari para cezasıdır (6563 s. K. md. 6).',
  })
  izinKaydet(
    @Body() dto: IzinKaydetDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.komut.izinKaydet(dto, principal);
  }

  @Get('kisiler/:kisiId')
  @RequirePermission(IZINLER.ILETI_GONDER)
  @ApiOperation({
    summary: 'Kişi kartı iletişim bilgisi',
    description:
      'WhatsApp numarası · telefon · izin durumları · son gönderim · mesaj ' +
      'geçmişi. Malik · Kiracı · Sakin kartları bu ucu kullanır.\n\n' +
      '⚠️  DAİRE GÖREVLİSİ bir `Kisi` DEĞİLDİR (0010); kendi kaydında WhatsApp ' +
      'numarası taşır (0020) ama kişiye bağlı izin kaydı tutulamaz.',
  })
  kisiIletisimi(
    @Param('kisiId') kisiId: string,
    @AktifPrincipal() principal: Principal,
  ): ReturnType<IletisimQueryServisi['kisiIletisimi']> {
    return this.sorgu.kisiIletisimi(kisiId, principal);
  }

  /* ---------------------------- Otomatik kural --------------------------- */

  @Get('kurallar')
  @RequirePermission(IZINLER.ILETI_AYAR)
  @ApiOperation({
    summary: 'Otomatik bildirim kuralları',
    description:
      '⚠️  KURAL AKTİF OLSA BİLE ŞU AN HİÇBİR ŞEY OTOMATİK GÖNDERİLMEZ: olay ' +
      'tüketicisi (outbox) henüz yazılmadı. Kural kaydı "gönderilecek" ' +
      'anlamına gelmez.',
  })
  kurallar(
    @AktifPrincipal() principal: Principal,
  ): ReturnType<IletisimQueryServisi['kurallar']> {
    return this.sorgu.kurallar(principal);
  }

  @Post('kurallar')
  @RequirePermission(IZINLER.ILETI_AYAR)
  @ApiOperation({ summary: 'Otomatik bildirim kuralı kaydet' })
  kuralKaydet(
    @Body() dto: KuralKaydetDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.komut.kuralKaydet(dto, principal);
  }
}
