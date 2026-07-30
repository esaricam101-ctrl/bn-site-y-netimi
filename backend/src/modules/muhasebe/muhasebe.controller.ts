import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Principal } from '@bnos/kernel';
import { IZINLER } from '@bnos/core-domain';
import { AktifPrincipal, RequirePermission } from '../../common/decorators';
import { HesapPlaniServisi, type HesapSatiri } from './hesap-plani.service';
import { FisCommandServisi } from './fis.command.service';
import {
  DefterQueryServisi,
  type MizanDokumu, type MuavinDokumu, type YevmiyeSatirDokumu,
} from './defter.query.service';
import { DonemServisi, type DonemSatiri } from './donem.service';
import { ParametreServisi, type ParametreGorunumu } from './parametre.service';
import {
  DonemAcDto, DonemKapatDto, FisEkleDto, FisStornoDto,
  HesapDuzeltDto, HesapEkleDto, HesapSilDto, ParametreKaydetDto,
} from './dto/muhasebe.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

/**
 * Muhasebe — hesap planı · fişler · defterler · mizan · dönem kapanışı.
 *
 * YETKİLER MEVCUT SİSTEMDEN gelir, yeni izin TANIMLANMADI:
 *   · `FINANS_DEFTER_GORUNTULE` → okuma (defter · mizan · muavin · fiş listesi)
 *   · `FINANS_YEVMIYE_GIRIS`    → fiş yazma · işleme · storno · hesap planı
 *   · `FINANS_DONEM_KAPAT`      → dönem açılış/kapanış · yeniden numaralandırma
 *   · `FINANS_AYAR`             → parametreler
 *
 * ⚠️  FİŞ SİLME UCU YOKTUR ve olmayacaktır. `yevmiye_fisi` FİNANSAL sınıftır;
 *     düzeltme yalnızca ters kayıt (storno) ile yapılır.
 */
@ApiTags('Muhasebe')
@ApiBearerAuth()
@Controller('muhasebe')
export class MuhasebeController {
  constructor(
    private readonly hesapPlani: HesapPlaniServisi,
    private readonly fis: FisCommandServisi,
    private readonly defter: DefterQueryServisi,
    private readonly donem: DonemServisi,
    private readonly parametre: ParametreServisi,
  ) {}

  /* ----------------------------- Hesap Planı ----------------------------- */

  @Get('hesaplar')
  @RequirePermission(IZINLER.FINANS_DEFTER_GORUNTULE)
  @ApiQuery({ name: 'arama', required: false })
  @ApiQuery({ name: 'tip', required: false, example: 'VARLIK' })
  @ApiQuery({ name: 'ozellik', required: false, example: 'KASA' })
  @ApiQuery({ name: 'yalnizcaAktif', required: false })
  @ApiOperation({
    summary: 'Hesap planı — kod sırasına göre',
    description:
      'Sıralama KODA göredir çünkü mizanın satır sırası da odur; ada göre ' +
      'sıralansaydı iki rapor farklı sırada çıkar ve karşılaştırılamazdı.\n\n' +
      '`seviye` koddan türetilir (100 → 0, 100.01 → 1) ve arayüz girinti için ' +
      'kullanır. `hareketSayisi` silme kararının dayanağıdır.',
  })
  hesaplar(
    @AktifPrincipal() principal: Principal,
    @Query('arama') arama?: string,
    @Query('tip') tip?: string,
    @Query('ozellik') ozellik?: string,
    @Query('yalnizcaAktif') yalnizcaAktif?: string,
  ): Promise<readonly HesapSatiri[]> {
    return this.hesapPlani.listele(principal, {
      ...(arama ? { arama } : {}),
      ...(tip ? { tip } : {}),
      ...(ozellik ? { ozellik } : {}),
      ...(yalnizcaAktif === 'true' ? { yalnizcaAktif: true } : {}),
    });
  }

  @Post('hesaplar')
  @RequirePermission(IZINLER.FINANS_YEVMIYE_GIRIS)
  @ApiOperation({
    summary: 'Hesap ekle',
    description:
      'Alt hesabın kodu ÜST HESAP KODUYLA BAŞLAMAK ZORUNDADIR ve tipi üst ' +
      'hesapla aynı olmalıdır: aksi hâlde hesap ağacı ile kod düzeni koparsa ' +
      'mizan ile muavin aynı sonucu vermez.\n\n' +
      'Alt hesap eklenen ÜST HESABA artık fiş kesilemez (otomatik): ara hesaba ' +
      'doğrudan kayıt, alt hesapların toplamını bozar.',
  })
  hesapEkle(
    @Body() dto: HesapEkleDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.hesapPlani.ekle(dto, principal);
  }

  @Patch('hesaplar/:id')
  @RequirePermission(IZINLER.FINANS_YEVMIYE_GIRIS)
  @ApiOperation({
    summary: 'Hesap düzelt — KOD ve TİP değiştirilemez',
    description:
      'Kod değişirse geçmiş mizanların satır sırası değişir ve yayımlanmış ' +
      'raporlarla tutmaz. Tip değişirse hesap bilançodan gelir tablosuna atlar ' +
      've geçmiş dönemlerin sonucu sessizce başkalaşır. Yanlış girilmişse hesap ' +
      'pasife alınıp yenisi açılır.',
  })
  hesapDuzelt(
    @Param('id') id: string,
    @Body() dto: HesapDuzeltDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.hesapPlani.duzelt(id, dto, principal);
  }

  @Delete('hesaplar/:id')
  @RequirePermission(IZINLER.FINANS_YEVMIYE_GIRIS)
  @ApiOperation({
    summary: 'Hesabı arşivle (soft delete)',
    description:
      'HAREKET GÖRMÜŞ ya da ALT HESABI OLAN hesap arşivlenemez: yevmiye ' +
      'satırları sahipsiz kalır ve mizan ile muavin tutmaz. Gerekçe zorunludur.',
  })
  hesapSil(
    @Param('id') id: string,
    @Body() dto: HesapSilDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.hesapPlani.softSil(id, dto.gerekce, principal);
  }

  /* --------------------------------- Fiş --------------------------------- */

  @Get('fisler')
  @RequirePermission(IZINLER.FINANS_DEFTER_GORUNTULE)
  @ApiQuery({ name: 'baslangic', required: false, example: '2026-01-01' })
  @ApiQuery({ name: 'bitis', required: false, example: '2026-12-31' })
  @ApiQuery({ name: 'fisTuru', required: false })
  @ApiQuery({ name: 'durum', required: false })
  @ApiQuery({ name: 'arama', required: false })
  @ApiQuery({ name: 'limit', required: false, example: 100 })
  @ApiOperation({
    summary: 'Muhasebe fişleri',
    description: 'Sayfalama sınırı 500: sınırsız liste tarayıcıyı kilitler.',
  })
  fisler(
    @AktifPrincipal() principal: Principal,
    @Query('baslangic') baslangic?: string,
    @Query('bitis') bitis?: string,
    @Query('fisTuru') fisTuru?: string,
    @Query('durum') durum?: string,
    @Query('arama') arama?: string,
    @Query('limit') limit?: string,
  ): Promise<unknown> {
    return this.defter.fisListele(principal, {
      ...(baslangic ? { baslangic } : {}),
      ...(bitis ? { bitis } : {}),
      ...(fisTuru ? { fisTuru } : {}),
      ...(durum ? { durum } : {}),
      ...(arama ? { arama } : {}),
      ...(limit ? { limit: Number(limit) } : {}),
    });
  }

  @Post('fisler')
  @RequirePermission(IZINLER.FINANS_YEVMIYE_GIRIS)
  @ApiOperation({
    summary: 'Muhasebe fişi oluştur',
    description:
      'ÇİFT KAYIT: en az iki satır ve borç toplamı = alacak toplamı. Bir ' +
      'satırda borç VEYA alacak dolu olur; ikisi birlikte netleştirme demektir ' +
      've hesabın ne kadar hareket gördüğü kaybolur.\n\n' +
      'KAPALI DÖNEME FİŞ YAZILAMAZ. Fiş no BOŞLUKSUZ seriden alınır.\n\n' +
      '`hemenIsle: true` ile aynı işlemde deftere girer; aksi hâlde TASLAK ' +
      'kalır ve mizanda görünmez.',
  })
  fisEkle(
    @Body() dto: FisEkleDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu & { readonly fisNo: string }> {
    return this.fis.ekle(dto, principal);
  }

  @Patch('fisler/:id/isle')
  @RequirePermission(IZINLER.FINANS_YEVMIYE_GIRIS)
  @ApiOperation({
    summary: 'Taslak fişi işle — deftere al',
    description:
      'TEK YÖNLÜ geçiş: "işlemeyi geri al" diye bir işlem yoktur, çünkü fiş ' +
      'deftere girdiği anda mizanı ve mali tabloyu etkilemiş olur. Düzeltme ' +
      'ters kayıtla yapılır.',
  })
  fisIsle(
    @Param('id') id: string,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.fis.isle(id, principal);
  }

  @Post('fisler/:id/storno')
  @RequirePermission(IZINLER.FINANS_YEVMIYE_GIRIS)
  @ApiOperation({
    summary: 'Ters kayıt (storno) oluştur',
    description:
      'Orijinalin borç/alacak yönleri TERS ÇEVRİLİR; negatif tutar YAZILMAZ — ' +
      'eksi tutar mizan toplamlarını bozar.\n\n' +
      'Orijinal fiş SİLİNMEZ, durumu TERS_KAYITLI olur ve iki kayıt birbirine ' +
      'referans verir. Ters kayıt, orijinalin dönemine değil VERİLEN TARİHİN ' +
      'dönemine yazılır: orijinalin dönemi kapanmış olabilir.',
  })
  fisStorno(
    @Param('id') id: string,
    @Body() dto: FisStornoDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu & { readonly tersFisId: string; readonly tersFisNo: string }> {
    return this.fis.storno(id, dto, principal);
  }

  /* ------------------------------- Defterler ------------------------------ */

  @Get('defterler/yevmiye')
  @RequirePermission(IZINLER.FINANS_DEFTER_GORUNTULE)
  @ApiQuery({ name: 'baslangic', required: true, example: '2026-01-01' })
  @ApiQuery({ name: 'bitis', required: true, example: '2026-12-31' })
  @ApiOperation({
    summary: 'Yevmiye Defteri',
    description:
      'Sıralama: yevmiye sıra no varsa ONA göre, yoksa tarih + fiş no ' +
      '(VUK md. 183 — tarih sırasıyla tutulur).\n\n' +
      'TASLAK fiş varsayılan olarak DIŞARIDADIR; parametre `taslakMizanaGirer` ' +
      'bunu açar. TERS_KAYITLI fiş defterde KALIR: storno onu iptal etmez, ' +
      'karşı kayıtla etkisini sıfırlar.',
  })
  yevmiyeDefteri(
    @AktifPrincipal() principal: Principal,
    @Query('baslangic') baslangic: string,
    @Query('bitis') bitis: string,
  ): Promise<readonly YevmiyeSatirDokumu[]> {
    return this.defter.yevmiyeDefteri(principal, { baslangic, bitis });
  }

  @Get('defterler/muavin/:hesapId')
  @RequirePermission(IZINLER.FINANS_DEFTER_GORUNTULE)
  @ApiQuery({ name: 'baslangic', required: true })
  @ApiQuery({ name: 'bitis', required: true })
  @ApiOperation({
    summary: 'Büyük Defter / Muavin — tek hesabın hareket dökümü',
    description:
      'AÇILIŞ BAKİYESİ aralıktan ÖNCEKİ hareketlerin netidir; hesaplanmasaydı ' +
      'dönem içi döküm hesabın devrini göstermez ve yürüyen bakiye yanlış ' +
      'başlardı.\n\n' +
      'Bakiye DOĞAL YÖNE göre işaretlenir: 100 Kasa borç, 300 Krediler alacak ' +
      'bakiyeli çalışır. Tek yönlü hesaplansaydı özkaynak ve borç hesapları ' +
      'negatif görünürdü.',
  })
  muavin(
    @Param('hesapId') hesapId: string,
    @AktifPrincipal() principal: Principal,
    @Query('baslangic') baslangic: string,
    @Query('bitis') bitis: string,
  ): Promise<MuavinDokumu | null> {
    return this.defter.muavin(principal, hesapId, { baslangic, bitis });
  }

  @Get('defterler/kasa')
  @RequirePermission(IZINLER.FINANS_DEFTER_GORUNTULE)
  @ApiQuery({ name: 'baslangic', required: true })
  @ApiQuery({ name: 'bitis', required: true })
  @ApiQuery({
    name: 'ozellik', required: false, example: 'KASA',
    description: 'KASA (varsayılan) ya da BANKA — aynı uç Banka Defteri üretir.',
  })
  @ApiOperation({
    summary: 'Kasa Defteri (ve Banka Defteri)',
    description:
      'Hesap KODUNA bakılmaz: kod planı tenant\'a göre değişir ve "100" her ' +
      'tenant\'ta kasa olmayabilir. Ayrım `hesap.ozellik` alanında VERİ olarak ' +
      'durur (§33 kural 3).',
  })
  kasaDefteri(
    @AktifPrincipal() principal: Principal,
    @Query('baslangic') baslangic: string,
    @Query('bitis') bitis: string,
    @Query('ozellik') ozellik?: string,
  ): Promise<readonly MuavinDokumu[]> {
    return this.defter.kasaDefteri(
      principal, { baslangic, bitis },
      ozellik === 'BANKA' ? 'BANKA' : 'KASA',
    );
  }

  @Get('dokumler/mizan')
  @RequirePermission(IZINLER.FINANS_DEFTER_GORUNTULE)
  @ApiQuery({ name: 'baslangic', required: true })
  @ApiQuery({ name: 'bitis', required: true })
  @ApiOperation({
    summary: 'Mizan',
    description:
      '`denkMi` yanıtta DÖNER ve gizlenmez: borç ≠ alacak ise deftere denk ' +
      'olmayan bir fiş girmiş demektir ve kullanıcı bunu raporun kendisinden ' +
      'görmelidir. Sessizce düzeltmek hatanın kaynağını gizlerdi.\n\n' +
      'Hareketsiz hesap GÖSTERİLMEZ: yüzlerce sıfır satır raporu okunamaz ' +
      'kılar (hesap planı dökümü ayrı uçtur).',
  })
  mizan(
    @AktifPrincipal() principal: Principal,
    @Query('baslangic') baslangic: string,
    @Query('bitis') bitis: string,
  ): Promise<MizanDokumu> {
    return this.defter.mizan(principal, { baslangic, bitis });
  }

  /* -------------------------------- Dönem -------------------------------- */

  @Get('donemler')
  @RequirePermission(IZINLER.FINANS_DEFTER_GORUNTULE)
  @ApiOperation({
    summary: 'Muhasebe dönemleri',
    description:
      'Her satır fiş sayısı, taslak fiş sayısı ve deftere basılmamış (yevmiye ' +
      'sıra no boş) fiş sayısını taşır: kapanış öncesi kontrol listesi budur.',
  })
  donemler(@AktifPrincipal() principal: Principal): Promise<readonly DonemSatiri[]> {
    return this.donem.listele(principal);
  }

  @Post('donemler')
  @RequirePermission(IZINLER.FINANS_DONEM_KAPAT)
  @ApiOperation({
    summary: 'Yeni dönem açılışı',
    description:
      'Aynı mali yıl iki kez açılamaz ve TARİH ARALIĞI ÇAKIŞAMAZ: iki dönem ' +
      'aynı günü kapsarsa fişin hangi döneme ait olduğu belirsiz kalır ve ' +
      'mizan iki kez sayar.',
  })
  donemAc(
    @Body() dto: DonemAcDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.donem.ac(dto, principal);
  }

  @Post('donemler/:id/acilis-fisi')
  @RequirePermission(IZINLER.FINANS_DONEM_KAPAT)
  @ApiOperation({
    summary: 'Muhasebe açılış işlemleri — önceki dönemin devri',
    description:
      'Yalnızca BİLANÇO hesapları devreder (varlık · borç · özkaynak). Gelir ve ' +
      'gider hesapları kapanışta sıfırlandığı için devretmez; devretseydi ' +
      'geçmiş yılın kârı yeni yılın gelir tablosunda ikinci kez görünürdü.\n\n' +
      'Önceki dönem KAPALI olmalıdır: devir, kesinleşmiş bakiyelerden alınır.',
  })
  acilisFisi(
    @Param('id') id: string,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu & { readonly acilisFisiId: string; readonly satirSayisi: number }> {
    return this.donem.acilisFisiUret(id, principal);
  }

  @Post('donemler/:id/yansitma-fisi')
  @RequirePermission(IZINLER.FINANS_DONEM_KAPAT)
  @ApiOperation({
    summary: 'Yansıtma hesapları fişi (7/A · 7/B)',
    description:
      'Özelliği YANSITMA olan hesapların bakiyeleri karşı yöne yazılarak ' +
      'sıfırlanır. Hangi hesabın yansıtma olduğu KODA GÖMÜLMEZ, ' +
      '`hesap.ozellik` alanından okunur.\n\n' +
      'Yansıtma hesaplarının bakiyeleri birbirini kapatmıyorsa uç 422 döner ve ' +
      'fişin elle girilmesi istenir: karşı hesap otomatik tahmin edilemez.',
  })
  yansitmaFisi(
    @Param('id') id: string,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu & { readonly fisId: string; readonly satirSayisi: number }> {
    return this.donem.yansitmaFisiUret(id, principal);
  }

  @Post('donemler/:id/yevmiye-numarala')
  @RequirePermission(IZINLER.FINANS_DONEM_KAPAT)
  @ApiOperation({
    summary: 'Yevmiye yeniden numaralandırma',
    description:
      'Yevmiye defteri TARİH SIRASIYLA tutulur (VUK md. 183). Fişler giriş ' +
      'sırasına göre `fisNo` alır ama tarih sırası farklı olabilir.\n\n' +
      '⚠️ `fisNo` DEĞİŞTİRİLMEZ — makbuz ve dekont üzerinde o numara yazılıdır; ' +
      'değiştirilse belge ile defter tutmaz. Yalnızca `yevmiyeSiraNo` yazılır.\n\n' +
      'TASLAK fiş numaralanmaz (deftere girmemiştir). Kapalı dönemde çalışmaz.',
  })
  yevmiyeNumarala(
    @Param('id') id: string,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu & { readonly numaralananFisSayisi: number }> {
    return this.donem.yevmiyeYenidenNumarala(id, principal);
  }

  @Post('donemler/:id/kapat')
  @RequirePermission(IZINLER.FINANS_DONEM_KAPAT)
  @ApiOperation({
    summary: 'Mali yıl kapanışı — GERİ ALINAMAZ',
    description:
      'Kapanış fişi gelir ve gider hesaplarını SIFIRLAR; net sonuç dönem ' +
      'kâr/zarar hesabına aktarılır. Bilanço hesapları DEVREDER, sıfırlanmaz.\n\n' +
      'Önkoşullar kapanıştan ÖNCE denetlenir: taslak fiş kalmışsa kapanış eksik ' +
      'hesaplanır ve sonradan düzeltilemez. Gerekçe zorunludur (en az 10 karakter).',
  })
  donemKapat(
    @Param('id') id: string,
    @Body() dto: DonemKapatDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu & {
    readonly kapanisFisiId: string; readonly sonuc: string; readonly tutar: string;
  }> {
    return this.donem.kapat(id, dto, principal);
  }

  /* ----------------------------- Parametreler ---------------------------- */

  @Get('parametreler')
  @RequirePermission(IZINLER.FINANS_AYAR)
  @ApiOperation({
    summary: 'Muhasebe parametreleri',
    description: 'Kayıt yoksa VARSAYILANLAR döner; boş nesne arayüzü askıda bırakırdı.',
  })
  parametreler(@AktifPrincipal() principal: Principal): Promise<ParametreGorunumu> {
    return this.parametre.oku(principal);
  }

  @Patch('parametreler')
  @RequirePermission(IZINLER.FINANS_AYAR)
  @ApiOperation({
    summary: 'Muhasebe parametrelerini kaydet',
    description:
      'Seçilen hesapların FİŞ KESİLEBİLİR ve AKTİF olduğu doğrulanır: ara ' +
      'hesap varsayılan kasa yapılırsa tahsilat fişi her denemede hata verir.\n\n' +
      'Değişiklik DENETİME YAZILIR: `taslakMizanaGirer` gibi bir bayrak mali ' +
      'tabloyu değiştirir ve kimin açtığı sorulabilir olmalıdır.',
  })
  parametreKaydet(
    @Body() dto: ParametreKaydetDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<{ readonly durum: string }> {
    return this.parametre.kaydet(dto, principal);
  }
}
