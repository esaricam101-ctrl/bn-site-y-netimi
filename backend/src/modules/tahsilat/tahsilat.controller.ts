import {
  Body, Controller, Get, Param, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Principal } from '@bnos/kernel';
import { IZINLER } from '@bnos/core-domain';
import { AktifPrincipal, RequirePermission } from '../../common/decorators';
import { TahsilatCommandServisi } from './tahsilat.command.service';
import {
  MakbuzQueryServisi,
  type CariEkstreDokumu, type KontrolMutabakatDokumu,
  type MakbuzDetayi, type MakbuzSatiri,
} from './makbuz.query.service';
import {
  OtomatikTahsisDto, TahsilatEkleDto, TahsilatIptalDto,
  TahsilatMuhasebelestirDto,
} from './dto/tahsilat.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

/**
 * MAKBUZLAR — tahsilat makbuzu · makbuz geçmişi · makbuz iptali · cari ekstre.
 *
 * Makbuz AYRI BİR VARLIK DEĞİLDİR: `tahsilat` kaydının belge görünümüdür.
 * Ayrı bir `makbuz` tablosu açılsaydı aynı para iki yerde durur ve biri
 * güncellenmediğinde makbuz ile defter tutmazdı.
 *
 * YETKİLER MEVCUT SİSTEMDEN gelir, yeni izin TANIMLANMADI:
 *   · `FINANS_BORCLU_DETAY`  → açık borçlar · cari ekstre · yaşlandırma
 *   · `FINANS_MAKBUZ`        → makbuz geçmişi ve detayı (okuma)
 *   · `FINANS_TAHSILAT`      → tahsilat girişi ve makbuz iptali (yazma)
 *   · `FINANS_YEVMIYE_GIRIS` → muhasebeleştirme (deftere yazma)
 *   · `FINANS_DEFTER_GORUNTULE` → kontrol hesabı mutabakatı
 *
 * ⚠️  MAKBUZ SİLME UCU YOKTUR ve olmayacaktır. `tahsilat` FİNANSAL sınıftır;
 *     iptal `durum = IPTAL` ile yapılır ve makbuz numarası KORUNUR (VUK:
 *     makbuz numarası atlamaz).
 */
@ApiTags('Makbuzlar')
@ApiBearerAuth()
@Controller('makbuzlar')
export class TahsilatController {
  constructor(
    private readonly komut: TahsilatCommandServisi,
    private readonly sorgu: MakbuzQueryServisi,
  ) {}

  /* ---------------------------- Makbuz geçmişi --------------------------- */

  @Get()
  @RequirePermission(IZINLER.FINANS_MAKBUZ)
  @ApiQuery({ name: 'baslangic', required: false, example: '2026-01-01' })
  @ApiQuery({ name: 'bitis', required: false, example: '2026-12-31' })
  @ApiQuery({ name: 'kanal', required: false, example: 'NAKIT' })
  @ApiQuery({ name: 'durum', required: false, example: 'GECERLI' })
  @ApiQuery({ name: 'bolumId', required: false })
  @ApiQuery({ name: 'kisiId', required: false })
  @ApiOperation({
    summary: 'Makbuz Geçmişi',
    description:
      'İPTAL EDİLMİŞ MAKBUZLAR DA LİSTEDE DÖNER (`durum` alanıyla ayrılır). ' +
      'Gizlenselerdi "kaç makbuz kesildi" sorusunun cevabı defterle tutmazdı ' +
      've numara serisindeki boşluk açıklanamaz görünürdü.\n\n' +
      '`kisiId` süzgeci hem ÖDEYEN hem de borç sorumlusu üzerinden eşleşir: ' +
      'kişi kendi borcunu ödemiş de olabilir, komşusu adına ödemiş de.',
  })
  makbuzlar(
    @AktifPrincipal() principal: Principal,
    @Query('baslangic') baslangic?: string,
    @Query('bitis') bitis?: string,
    @Query('kanal') kanal?: string,
    @Query('durum') durum?: string,
    @Query('bolumId') bolumId?: string,
    @Query('kisiId') kisiId?: string,
  ): Promise<readonly MakbuzSatiri[]> {
    return this.sorgu.makbuzlariListele(principal, {
      ...(baslangic ? { baslangic } : {}),
      ...(bitis ? { bitis } : {}),
      ...(kanal ? { kanal } : {}),
      ...(durum ? { durum } : {}),
      ...(bolumId ? { bolumId } : {}),
      ...(kisiId ? { kisiId } : {}),
    });
  }

  @Get(':id')
  @RequirePermission(IZINLER.FINANS_MAKBUZ)
  @ApiOperation({
    summary: 'Tahsilat Makbuzu — tam detay',
    description:
      'Makbuz No · Tarih · Tahsilatı Alan · Malik · Kiracı · Sakin · Daire · ' +
      'Borç Kalemi · Dönem · Tahsilat Türü · Banka · Açıklama · Tahsil Edilen ' +
      'Tutar · Kalan Borç · İlişkili Muhasebe Fişi · İlişkili Banka Hareketi · ' +
      'İlişkili Cari Hesap (= bölüm, ADR-0010).\n\n' +
      '⚠️  MALİK · KİRACI · SAKİN alanları ÖDEYENDEN DEĞİL borcun sorumluluk ' +
      'zincirinden gelir: ödeyen komşusu ya da akrabası olabilir.',
  })
  makbuzDetayi(
    @Param('id') id: string,
    @AktifPrincipal() principal: Principal,
  ): Promise<MakbuzDetayi> {
    return this.sorgu.makbuzDetayi(id, principal);
  }

  /* --------------------------- Tahsilat girişi --------------------------- */

  @Get('borclar/:bolumId')
  @RequirePermission(IZINLER.FINANS_BORCLU_DETAY)
  @ApiQuery({ name: 'kisiId', required: false })
  @ApiOperation({
    summary: 'Detaylı Tahsilat Girişi — bölümün açık borçları',
    description:
      'Hem borcun kendisi hem de HİSSELİ MÜLKİYETTE pay satırları döner; ' +
      'tahsis ikisinden birine yapılır. Sorumlusu olan borç yalnızca PAY ' +
      'satırlarıyla döner: ikisi bir arada verilseydi aynı para iki kez ' +
      'tahsis edilebilirdi.',
  })
  acikBorclar(
    @Param('bolumId') bolumId: string,
    @AktifPrincipal() principal: Principal,
    @Query('kisiId') kisiId?: string,
  ): ReturnType<MakbuzQueryServisi['acikBorclar']> {
    return this.sorgu.acikBorclar(bolumId, principal, kisiId);
  }

  @Post('tahsis-onerisi')
  @RequirePermission(IZINLER.FINANS_BORCLU_DETAY)
  @ApiOperation({
    summary: 'Otomatik tahsis önerisi — HİÇBİR ŞEY YAZMAZ',
    description:
      'EN ESKİ VADE ÖNCE (FIFO). En yeni borç önce kapatılsaydı eski borç ' +
      'sürekli açık kalır, gecikme faizi büyür ve borçlu her ay ödeme ' +
      'yapmasına rağmen "temerrütte" görünürdü.\n\n' +
      'Açık borca sığmayan tutar `kalan` olarak DÖNER ve `not` alanı nedenini ' +
      'söyler — sessizce yutulmaz.',
  })
  tahsisOnerisi(
    @Body() dto: OtomatikTahsisDto,
    @AktifPrincipal() principal: Principal,
  ): ReturnType<MakbuzQueryServisi['tahsisOnerisi']> {
    return this.sorgu.tahsisOnerisi(dto.tutar, dto.bolumId, principal, dto.kisiId);
  }

  @Post()
  @RequirePermission(IZINLER.FINANS_TAHSILAT)
  @ApiOperation({
    summary: 'Tahsilat Makbuzu oluştur',
    description:
      'TAHSİS TOPLAMI TAHSİLAT TUTARINA EŞİT OLMAK ZORUNDA. Eksik olsaydı ' +
      'paranın bir kısmı hiçbir borca sayılmaz ve hiçbir yerde görünmezdi — ' +
      'kasada/bankada duran ama defterde olmayan para. AVANS (borcu aşan ' +
      'ödeme) desteklenmiyor ve fazla ödeme SESSİZCE YUTULMAZ, reddedilir.\n\n' +
      'Makbuz numarası BOŞLUKSUZ seridir (VUK).\n\n' +
      'Kanal KANIT ister: BANKA → banka hareketi, ÇEK/SENET → kıymetli evrak. ' +
      'NAKİT kanalına banka hareketi BAĞLANAMAZ (aynı para iki kez sayılır).\n\n' +
      'Kayıt sonrası `borc.odenen` tahsis satırlarından YENİDEN HESAPLANIR — ' +
      'artırılmaz.',
  })
  ekle(
    @Body() dto: TahsilatEkleDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.komut.ekle(dto, principal);
  }

  @Post(':id/iptal')
  @RequirePermission(IZINLER.FINANS_TAHSILAT)
  @ApiOperation({
    summary: 'Makbuz İptali — kayıt SİLİNMEZ',
    description:
      '`durum = IPTAL` olur; gerekçe ve iptal eden yazılır. MAKBUZ NUMARASI ' +
      'KORUNUR: seride boşluk oluşsaydı "kaç makbuz kesildi" sorusunun cevabı ' +
      'defterle tutmazdı.\n\n' +
      'Tahsis satırları silinir ve borç bakiyeleri yeniden hesaplanır; ' +
      'bırakılsaydı iptal edilmiş bir makbuz borcu kapatmaya devam ederdi.\n\n' +
      'MUHASEBELEŞMİŞ tahsilat iptal EDİLEMEZ — önce fişin ters kaydı (storno) ' +
      'gerekir, aksi hâlde fiş ile cari defter kalıcı olarak ayrışır.',
  })
  iptal(
    @Param('id') id: string,
    @Body() dto: TahsilatIptalDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.komut.iptal(id, dto, principal);
  }

  @Post(':id/muhasebelestir')
  @RequirePermission(IZINLER.FINANS_YEVMIYE_GIRIS)
  @ApiOperation({
    summary: 'Makbuzu muhasebeleştir — yevmiye fişi üretir',
    description:
      'BORÇ = paranın girdiği hesap (NAKİT → varsayılan kasa, BANKA/POS → ' +
      'banka hareketinin hesabı ya da varsayılan banka). ALACAK = cari kontrol ' +
      'hesabı (`ozellik = CARI_KONTROL`).\n\n' +
      'Alacak tarafı SABİTTİR çünkü tahsilat her zaman bir ALACAĞI kapatır; ' +
      'borç tarafı paranın nereye girdiğine bağlıdır.\n\n' +
      '⚠️  ÇEK · SENET · MAHSUP için hesap tanımı YOKTUR ve işlem AÇIKÇA ' +
      'reddedilir. "En yakın" hesap seçilseydi para yanlış hesaba yazılır ve ' +
      'hata yalnızca mizan tutmadığında — aylar sonra — fark edilirdi.',
  })
  muhasebelestir(
    @Param('id') id: string,
    @Body() dto: TahsilatMuhasebelestirDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.komut.muhasebelestir(id, dto, principal);
  }

  /* ------------------------------ Cari ekstre ---------------------------- */

  @Get('cari/:bolumId')
  @RequirePermission(IZINLER.FINANS_BORCLU_DETAY)
  @ApiQuery({ name: 'baslangic', required: true, example: '2026-01-01' })
  @ApiQuery({ name: 'bitis', required: true, example: '2026-12-31' })
  @ApiQuery({
    name: 'kisiId', required: false,
    description: 'Verilirse KİŞİ EKSTRESİ üretir — ayrı bir defter değil, aynı motorun süzgeci.',
  })
  @ApiOperation({
    summary: 'Cari Hesap Ekstresi (ADR-0010)',
    description:
      'CARİ HESAP = BAĞIMSIZ BÖLÜM yardımcı defteri. Borç bölüme aittir ' +
      '(KMK md. 22); kişi ekstresi bir GÖRÜNÜMDÜR.\n\n' +
      'AÇILIŞ BAKİYESİ aralıktan öncekinin netidir — sıfır varsayılsaydı her ' +
      'ekstre borçlunun geçmişini silerdi.\n\n' +
      'AYNI GÜN içinde BORÇ önce, TAHSİLAT sonra sıralanır: ters sıralanırsa ' +
      'yürüyen bakiye o satırda NEGATİF çıkar ve okuyan "fazla ödeme yapılmış" ' +
      'sanır.\n\n' +
      'İPTAL edilmiş makbuzların tahsisleri EKSTREDE YOKTUR.',
  })
  cariEkstre(
    @Param('bolumId') bolumId: string,
    @Query('baslangic') baslangic: string,
    @Query('bitis') bitis: string,
    @AktifPrincipal() principal: Principal,
    @Query('kisiId') kisiId?: string,
  ): Promise<CariEkstreDokumu> {
    return this.sorgu.cariEkstreDokumu(bolumId, baslangic, bitis, principal, kisiId);
  }

  @Get('rapor/yaslandirma')
  @RequirePermission(IZINLER.FINANS_BORCLU_DETAY)
  @ApiOperation({
    summary: 'Alacak yaşlandırması',
    description:
      'Yaşlandırma VADEYE göre yapılır, borcun doğduğu tarihe göre değil: ' +
      'temerrüt vadeden itibaren işler (KMK md. 20/c). Kapanmış borç hiçbir ' +
      'kovada görünmez.',
  })
  yaslandirma(
    @AktifPrincipal() principal: Principal,
  ): ReturnType<MakbuzQueryServisi['yaslandirma']> {
    return this.sorgu.yaslandirma(principal);
  }

  @Get('rapor/kontrol-mutabakati')
  @RequirePermission(IZINLER.FINANS_DEFTER_GORUNTULE)
  @ApiOperation({
    summary: 'Yardımcı defter ↔ kontrol hesabı mutabakatı',
    description:
      'Σ (bölüm cari bakiyeleri) = `120 Alıcılar` hesabının defter bakiyesi ' +
      'olmak ZORUNDADIR (ADR-0010).\n\n' +
      '⚠️  `mutabikMi = false` ise DÖNEM KAPANIŞI BLOKE EDİLMELİDİR: ' +
      'yayımlanan bilançodaki alacak tutarı, borçlu bazında dökümlenen ' +
      'tutarların toplamıyla tutmazdı ve fark hangi daireden geldiği ' +
      'bilinmeden kalıcı hâle gelirdi.\n\n' +
      'TOLERANS YOKTUR: çift kayıt muhasebesinde bir kuruş fark da farktır.\n\n' +
      'Kontrol hesabı hiç işaretlenmemişse sonuç "mutabık" DÖNMEZ — sessiz ' +
      'geçilseydi eksiklik hiç fark edilmezdi.',
  })
  kontrolMutabakati(
    @AktifPrincipal() principal: Principal,
  ): Promise<KontrolMutabakatDokumu> {
    return this.sorgu.kontrolMutabakatDokumu(principal);
  }
}
