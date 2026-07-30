import {
  Body, Controller, Delete, Get, Param, Patch, Post, Put, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Principal } from '@bnos/kernel';
import { IZINLER } from '@bnos/core-domain';
import { AktifPrincipal, RequirePermission } from '../../common/decorators';
import {
  BankaTanimServisi,
  type BankaHesabiSatiri, type BankaSatiri, type PosSatiri, type SubeSatiri,
} from './banka-tanim.service';
import { BankaHareketCommandServisi } from './hareket.command.service';
import {
  BankaHareketQueryServisi,
  type HareketSatiri, type HesapBakiyesi,
} from './hareket.query.service';
import {
  EkstreServisi,
  type EkstreBasligi, type EslestirmeOnerisi, type MutabakatDokumu,
} from './ekstre.service';
import {
  KiymetliEvrakServisi, type EvrakOzeti, type EvrakSatiri,
} from './kiymetli-evrak.service';
import {
  BankaParametreServisi, type BankaParametreGorunumu,
} from './banka-parametre.service';
import {
  BankaDuzeltDto, BankaEkleDto, BankaHesabiDuzeltDto, BankaHesabiEkleDto,
  BankaParametreKaydetDto, EkstreEkleDto, EslestirDto, EvrakDurumDto,
  FarkKabulDto, HareketDuzeltDto, HareketEkleDto, KiymetliEvrakEkleDto,
  MuhasebelestirDto, PosDuzeltDto, PosEkleDto, SilDto, SubeDuzeltDto,
  SubeEkleDto, VirmanDto,
} from './dto/banka.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

/**
 * Banka Yönetimi — banka · şube · hesap · POS · hareket · ekstre · mutabakat ·
 * çek/senet · parametreler.
 *
 * YETKİLER MEVCUT SİSTEMDEN gelir, yeni izin TANIMLANMADI:
 *   · `FINANS_DEFTER_GORUNTULE` → bütün okuma uçları
 *   · `FINANS_AYAR`             → TANIM verisi (banka · şube · hesap · POS) ve
 *                                 parametreler
 *   · `FINANS_TAHSILAT`         → PARA HAREKETİ yazma (hareket · virman ·
 *                                 ekstre · mutabakat · çek/senet)
 *   · `FINANS_YEVMIYE_GIRIS`    → MUHASEBELEŞTİRME (deftere yazma)
 *
 * Bu ayrım bilinçlidir: banka hareketini kaydetmek ile onu DEFTERE YAZMAK
 * farklı yetkilerdir. KMK md. 35/d uyarınca parayı tahsil eden ve ödeyen taraf
 * yöneticidir; yevmiye kaydını atmak ise muhasebe işidir. Bu yüzden hareket
 * girişi `FINANS_TAHSILAT`, muhasebeleştirme `FINANS_YEVMIYE_GIRIS` ister.
 *
 * ⚠️  HAREKET SİLME UCU YOKTUR ve olmayacaktır. `banka_hareketi` mali kaydın
 *     dayanağıdır; muhasebeleşmiş hareket hiç değiştirilemez.
 */
@ApiTags('Banka')
@ApiBearerAuth()
@Controller('banka')
export class BankaController {
  constructor(
    private readonly tanim: BankaTanimServisi,
    private readonly hareketKomut: BankaHareketCommandServisi,
    private readonly hareketSorgu: BankaHareketQueryServisi,
    private readonly ekstre: EkstreServisi,
    private readonly evrak: KiymetliEvrakServisi,
    private readonly parametre: BankaParametreServisi,
  ) {}

  /* -------------------------------- Banka -------------------------------- */

  @Get('bankalar')
  @RequirePermission(IZINLER.FINANS_DEFTER_GORUNTULE)
  @ApiOperation({
    summary: 'Bankalar',
    description:
      '`subeSayisi` ve `hesapSayisi` silme kararının dayanağıdır: hesabı olan ' +
      'banka arşivlenemez.',
  })
  bankalar(@AktifPrincipal() principal: Principal): Promise<readonly BankaSatiri[]> {
    return this.tanim.bankalariListele(principal);
  }

  @Post('bankalar')
  @RequirePermission(IZINLER.FINANS_AYAR)
  @ApiOperation({
    summary: 'Banka ekle',
    description:
      'EFT kodu verilirse bu bankaya bağlanan hesapların IBAN\'ı ile ' +
      'KARŞILAŞTIRILIR ve uyuşmazsa hesap eklenemez: yanlış bankaya bağlanmış ' +
      'hesap, mutabakatta hareketin kaynağını kalıcı olarak yanlış gösterir.',
  })
  bankaEkle(
    @Body() dto: BankaEkleDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.tanim.bankaEkle(dto, principal);
  }

  @Patch('bankalar/:id')
  @RequirePermission(IZINLER.FINANS_AYAR)
  @ApiOperation({ summary: 'Banka düzelt' })
  bankaDuzelt(
    @Param('id') id: string,
    @Body() dto: BankaDuzeltDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.tanim.bankaDuzelt(id, dto, principal);
  }

  @Delete('bankalar/:id')
  @RequirePermission(IZINLER.FINANS_AYAR)
  @ApiOperation({
    summary: 'Bankayı arşivle (soft delete)',
    description:
      'HESABI, ŞUBESİ ya da ÇEKİ olan banka arşivlenemez: hesap sahipsiz kalır ' +
      've hareketleri hangi bankaya ait olduğu bilinmeyen kayıtlara dönüşür. ' +
      'Gerekçe zorunludur.',
  })
  bankaSil(
    @Param('id') id: string,
    @Body() dto: SilDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.tanim.bankaSil(id, dto.gerekce, principal);
  }

  /* --------------------------------- Şube -------------------------------- */

  @Get('subeler')
  @RequirePermission(IZINLER.FINANS_DEFTER_GORUNTULE)
  @ApiQuery({ name: 'bankaId', required: false })
  @ApiOperation({ summary: 'Banka şubeleri' })
  subeler(
    @AktifPrincipal() principal: Principal,
    @Query('bankaId') bankaId?: string,
  ): Promise<readonly SubeSatiri[]> {
    return this.tanim.subeleriListele(principal, bankaId);
  }

  @Post('subeler')
  @RequirePermission(IZINLER.FINANS_AYAR)
  @ApiOperation({ summary: 'Şube ekle' })
  subeEkle(
    @Body() dto: SubeEkleDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.tanim.subeEkle(dto, principal);
  }

  @Patch('subeler/:id')
  @RequirePermission(IZINLER.FINANS_AYAR)
  @ApiOperation({ summary: 'Şube düzelt' })
  subeDuzelt(
    @Param('id') id: string,
    @Body() dto: SubeDuzeltDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.tanim.subeDuzelt(id, dto, principal);
  }

  @Delete('subeler/:id')
  @RequirePermission(IZINLER.FINANS_AYAR)
  @ApiOperation({ summary: 'Şubeyi arşivle (soft delete)' })
  subeSil(
    @Param('id') id: string,
    @Body() dto: SilDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.tanim.subeSil(id, dto.gerekce, principal);
  }

  /* ----------------------------- Banka hesabı ---------------------------- */

  @Get('hesaplar')
  @RequirePermission(IZINLER.FINANS_DEFTER_GORUNTULE)
  @ApiQuery({ name: 'yalnizcaAktif', required: false })
  @ApiOperation({
    summary: 'Banka hesapları',
    description:
      'Her hesap bir MUHASEBE hesabına bağlıdır (`ozellik = BANKA`); yanıtta ' +
      'karşılığın kodu ve adı da döner. Bağ olmasaydı banka bakiyesi ile 102 ' +
      'Bankalar hesabının bakiyesi bağımsız iki sayı olurdu.',
  })
  hesaplar(
    @AktifPrincipal() principal: Principal,
    @Query('yalnizcaAktif') yalnizcaAktif?: string,
  ): Promise<readonly BankaHesabiSatiri[]> {
    return this.tanim.hesaplariListele(principal, {
      ...(yalnizcaAktif === 'true' ? { yalnizcaAktif: true } : {}),
    });
  }

  @Post('hesaplar')
  @RequirePermission(IZINLER.FINANS_AYAR)
  @ApiOperation({
    summary: 'Banka hesabı ekle',
    description:
      'IBAN mod-97 SAĞLAMA TOPLAMIYLA doğrulanır ve normallenmiş saklanır. ' +
      'Uzunluk denetimi yetmez: tek hane yanlış girilmiş bir IBAN biçimsel ' +
      'olarak kusursuz görünür ve hata ancak para başka hesaba gittiğinde ' +
      'anlaşılır.\n\n' +
      'Bağlanacak muhasebe hesabının `ozellik` alanı BANKA olmak ZORUNDADIR: ' +
      'yanlış özellikli hesaba bağlanırsa hem Kasa hem Banka Defteri yanlış ' +
      'çıkar.',
  })
  hesapEkle(
    @Body() dto: BankaHesabiEkleDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.tanim.hesapEkle(dto, principal);
  }

  @Patch('hesaplar/:id')
  @RequirePermission(IZINLER.FINANS_AYAR)
  @ApiOperation({
    summary: 'Banka hesabı düzelt — MUHASEBE KARŞILIĞI değiştirilemez',
    description:
      'Muhasebe karşılığı değişse geçmiş hareketlerin muhasebeleştiği hesap ile ' +
      'yeni hesap ayrışır ve iki hesabın da bakiyesi banka gerçeğiyle tutmaz. ' +
      'Yanlış girilmişse hesap pasife alınıp yenisi açılır.',
  })
  hesapDuzelt(
    @Param('id') id: string,
    @Body() dto: BankaHesabiDuzeltDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.tanim.hesapDuzelt(id, dto, principal);
  }

  @Delete('hesaplar/:id')
  @RequirePermission(IZINLER.FINANS_AYAR)
  @ApiOperation({
    summary: 'Banka hesabını arşivle (soft delete)',
    description:
      'HAREKET GÖRMÜŞ hesap arşivlenemez: hareketleri sahipsiz kalır ve banka ' +
      'gerçeği ile muhasebe karşılığı bir daha karşılaştırılamaz. Kullanımdan ' +
      'çıkarmak için `aktif = false` yeterlidir; geçmiş korunur.',
  })
  hesapSil(
    @Param('id') id: string,
    @Body() dto: SilDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.tanim.hesapSil(id, dto.gerekce, principal);
  }

  @Get('hesaplar/:id/bakiye')
  @RequirePermission(IZINLER.FINANS_DEFTER_GORUNTULE)
  @ApiQuery({ name: 'tarih', required: false, example: '2026-07-31' })
  @ApiOperation({
    summary: 'Hesap bakiyesi — İŞLEM ve VALÖR olmak üzere İKİ tutar',
    description:
      '`islemBakiyesi` defterin gördüğü tutardır. `valorBakiyesi` bankada ' +
      'GERÇEKTEN kullanılabilir tutardır; valörü gelmemiş hareketler ' +
      'hariçtir.\n\n' +
      'Tek sayı verilseydi POS tahsilatı henüz hesaba geçmemişken bakiyede ' +
      'görünür, harcanabilir sanılır ve karşılıksız ödeme yapılırdı. ' +
      '`yoldaTutar` ikisinin farkıdır.\n\n' +
      '`muhasebelesmemisSayisi` deftere girmeyi bekleyen hareket sayısıdır.',
  })
  bakiye(
    @Param('id') id: string,
    @AktifPrincipal() principal: Principal,
    @Query('tarih') tarih?: string,
  ): Promise<HesapBakiyesi> {
    return this.hareketSorgu.bakiye(id, principal, tarih);
  }

  /* ---------------------------------- POS -------------------------------- */

  @Get('pos')
  @RequirePermission(IZINLER.FINANS_DEFTER_GORUNTULE)
  @ApiQuery({ name: 'tip', required: false, example: 'SANAL' })
  @ApiOperation({
    summary: 'POS tanımları (fiziki ve sanal)',
    description:
      'Sanal POS ayrı bir kavram değildir; `tip` alanıyla ayrılır. ' +
      '`komisyonBinde` BİNDE tam sayıdır (25 = %2,5).',
  })
  posListesi(
    @AktifPrincipal() principal: Principal,
    @Query('tip') tip?: string,
  ): Promise<readonly PosSatiri[]> {
    return this.tanim.posListele(principal, { ...(tip ? { tip } : {}) });
  }

  @Post('pos')
  @RequirePermission(IZINLER.FINANS_AYAR)
  @ApiOperation({ summary: 'POS tanımı ekle' })
  posEkle(
    @Body() dto: PosEkleDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.tanim.posEkle(dto, principal);
  }

  @Patch('pos/:id')
  @RequirePermission(IZINLER.FINANS_AYAR)
  @ApiOperation({
    summary: 'POS tanımı düzelt',
    description:
      'Komisyon oranı değişikliği GEÇMİŞİ YENİDEN YAZMAZ: geçmiş tahsilatların ' +
      'komisyonu o günkü oranla hesaplanmıştır. Değişiklik denetime yazılır.',
  })
  posDuzelt(
    @Param('id') id: string,
    @Body() dto: PosDuzeltDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.tanim.posDuzelt(id, dto, principal);
  }

  @Delete('pos/:id')
  @RequirePermission(IZINLER.FINANS_AYAR)
  @ApiOperation({ summary: 'POS tanımını arşivle (soft delete)' })
  posSil(
    @Param('id') id: string,
    @Body() dto: SilDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.tanim.posSil(id, dto.gerekce, principal);
  }

  /* ------------------------------- Hareket ------------------------------- */

  @Get('hareketler')
  @RequirePermission(IZINLER.FINANS_DEFTER_GORUNTULE)
  @ApiQuery({ name: 'bankaHesabiId', required: false })
  @ApiQuery({ name: 'baslangic', required: false, example: '2026-07-01' })
  @ApiQuery({ name: 'bitis', required: false, example: '2026-07-31' })
  @ApiQuery({ name: 'islemTipi', required: false, example: 'HAVALE' })
  @ApiQuery({ name: 'yon', required: false, example: 'GIRIS' })
  @ApiQuery({
    name: 'yalnizcaMuhasebesiz', required: false,
    description: 'true ise YALNIZCA deftere girmemiş hareketler.',
  })
  @ApiOperation({
    summary: 'Banka hareketleri',
    description:
      'Havale · EFT · FAST · Virman · Masraf · POS tahsilatı AYNI listede döner ' +
      've `islemTipi` ile ayrılır. Ayrı uçlar olsaydı banka bakiyesi altı ayrı ' +
      'sorgunun toplamı olur ve biri unutulduğunda bakiye SESSİZCE yanlış ' +
      'çıkardı.\n\n' +
      '`yevmiyeFisiId` boşsa hareket henüz deftere girmemiştir. ' +
      '`mutabakatDurumu` bir ekstre satırıyla eşleşip eşleşmediğini gösterir.',
  })
  hareketler(
    @AktifPrincipal() principal: Principal,
    @Query('bankaHesabiId') bankaHesabiId?: string,
    @Query('baslangic') baslangic?: string,
    @Query('bitis') bitis?: string,
    @Query('islemTipi') islemTipi?: string,
    @Query('yon') yon?: string,
    @Query('yalnizcaMuhasebesiz') yalnizcaMuhasebesiz?: string,
  ): Promise<readonly HareketSatiri[]> {
    return this.hareketSorgu.listele(principal, {
      ...(bankaHesabiId ? { bankaHesabiId } : {}),
      ...(baslangic ? { baslangic } : {}),
      ...(bitis ? { bitis } : {}),
      ...(islemTipi ? { islemTipi } : {}),
      ...(yon ? { yon } : {}),
      ...(yalnizcaMuhasebesiz === 'true' ? { yalnizcaMuhasebesiz: true } : {}),
    });
  }

  @Post('hareketler')
  @RequirePermission(IZINLER.FINANS_TAHSILAT)
  @ApiOperation({
    summary: 'Banka hareketi ekle',
    description:
      'Tutar İŞARETSİZDİR ve yön `yon` alanındadır: negatif tutarla çıkış ' +
      'yazmak mümkün olsaydı "toplam giriş" sorgusu negatifleri de toplardı.\n\n' +
      'VIRMAN buradan yazılamaz — iki bacağı vardır, `POST /banka/virman` ' +
      'kullanılır.\n\n' +
      'Hareket kaydedildiğinde deftere GİRMEZ; muhasebeleştirme ayrı bir ' +
      'adımdır.',
  })
  hareketEkle(
    @Body() dto: HareketEkleDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.hareketKomut.ekle(dto, principal);
  }

  @Patch('hareketler/:id')
  @RequirePermission(IZINLER.FINANS_TAHSILAT)
  @ApiOperation({
    summary: 'Hareket düzelt — muhasebeleşmiş ya da eşleşmiş hareket değişmez',
    description:
      'MUHASEBELEŞMİŞ hareket bir yevmiye fişine dayanak olmuştur; değişirse ' +
      'fiş ile banka gerçeği kalıcı olarak ayrışır. Düzeltme: fişin storno\'su ' +
      '+ yeni hareket.\n\n' +
      'EŞLEŞMİŞ hareket de değişmez: mutabakat o tutar ve tarih üzerinden ' +
      'kurulmuştur, tutar değişirse eşleşme sessizce yanlışa döner.\n\n' +
      'HESAP ve YÖN hiçbir durumda değiştirilemez.',
  })
  hareketDuzelt(
    @Param('id') id: string,
    @Body() dto: HareketDuzeltDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.hareketKomut.duzelt(id, dto, principal);
  }

  @Post('virman')
  @RequirePermission(IZINLER.FINANS_TAHSILAT)
  @ApiOperation({
    summary: 'Virman — kendi hesapları arası transfer (İKİ hareket üretir)',
    description:
      'Çıkış ve giriş bacakları AYNI transaction\'da yazılır ve birbirine ' +
      'referans verir. Tek kayıt olsaydı hesap bazlı ekstre eksik çıkardı; ' +
      'ayrı işlemlerde yazılsaydı biri başarısız olduğunda para bir hesaptan ' +
      'çıkıp hiçbir yere girmemiş görünürdü.\n\n' +
      'FARKLI PARA BİRİMİ virman DEĞİLDİR (kur işlemidir) ve reddedilir.',
  })
  virman(
    @Body() dto: VirmanDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.hareketKomut.virman(dto, principal);
  }

  @Post('hareketler/:id/muhasebelestir')
  @RequirePermission(IZINLER.FINANS_YEVMIYE_GIRIS)
  @ApiOperation({
    summary: 'Hareketi muhasebeleştir — yevmiye fişi üretir',
    description:
      'Banka tarafı hesabın kendi muhasebe karşılığına yazılır; KARŞI HESAP ' +
      'çağırandan gelir çünkü aynı para girişi aidat tahsilatı da kira geliri ' +
      'de olabilir ve bunu sistem bilemez.\n\n' +
      'GİRİŞ → banka hesabı borçlu, karşı hesap alacaklı. ' +
      'ÇIKIŞ → banka hesabı alacaklı, karşı hesap borçlu.\n\n' +
      'Fiş üretimi ve hareketin işaretlenmesi AYNI transaction\'dadır: iki ayrı ' +
      'işlem olsaydı fiş yazılıp hareket işaretlenmeden hata alınabilir, ' +
      'hareket "muhasebeleşmemiş" görünmeye devam eder ve tekrar ' +
      'muhasebeleştirilerek AYNI PARA İKİ KEZ deftere girerdi.\n\n' +
      'Zaten muhasebeleşmiş hareket REDDEDİLİR.',
  })
  muhasebelestir(
    @Param('id') id: string,
    @Body() dto: MuhasebelestirDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.hareketKomut.muhasebelestir(id, dto, principal);
  }

  /* -------------------------- Ekstre · mutabakat ------------------------- */

  @Get('ekstreler')
  @RequirePermission(IZINLER.FINANS_DEFTER_GORUNTULE)
  @ApiQuery({ name: 'bankaHesabiId', required: false })
  @ApiOperation({
    summary: 'Banka ekstreleri',
    description: '`eslesmeyenSayisi` mutabakatın ne kadarının açık olduğunu gösterir.',
  })
  ekstreler(
    @AktifPrincipal() principal: Principal,
    @Query('bankaHesabiId') bankaHesabiId?: string,
  ): Promise<readonly EkstreBasligi[]> {
    return this.ekstre.ekstreleriListele(principal, bankaHesabiId);
  }

  @Post('ekstreler')
  @RequirePermission(IZINLER.FINANS_TAHSILAT)
  @ApiOperation({
    summary: 'Ekstre yükle (satırlarıyla birlikte)',
    description:
      'Satırlar AYNI işlemde yazılır: satır satır eklenebilir olsaydı yarım ' +
      'yüklenmiş bir ekstre ile mutabakat yapılır ve eksik satırlar "bankada ' +
      'yok" gibi görünürdü.\n\n' +
      'ARALIK ÇAKIŞMASI reddedilir: aynı günü kapsayan iki ekstre olursa aynı ' +
      'banka satırı iki kez mutabık edilir ve gerçek fark gizlenir.\n\n' +
      'Satır tarihleri ekstre aralığının dışına çıkamaz.',
  })
  ekstreEkle(
    @Body() dto: EkstreEkleDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.ekstre.ekstreEkle(dto, principal);
  }

  @Get('ekstreler/:id/mutabakat')
  @RequirePermission(IZINLER.FINANS_DEFTER_GORUNTULE)
  @ApiOperation({
    summary: 'Mutabakat dökümü — satırlar + özet',
    description:
      '`mutabikMi` YALNIZCA (a) eşleşmemiş satır kalmadığında VE (b) banka ' +
      'kapanış bakiyesi ile sistem bakiyesi eşit olduğunda `true` döner. ' +
      'Yalnızca satır sayısına bakılsaydı, ekstrede hiç görünmeyen bir sistem ' +
      'hareketi (bizde var, bankada yok) mutabakatı tamamlanmış gösterirdi.\n\n' +
      'Sistem bakiyesi ekstrenin BİTİŞ tarihine göre okunur; bugüne göre ' +
      'karşılaştırmak arada oluşan hareketleri fark gibi gösterirdi.\n\n' +
      '`bakiyeFarki` yanıtta DÖNER ve gizlenmez.',
  })
  mutabakat(
    @Param('id') id: string,
    @AktifPrincipal() principal: Principal,
  ): Promise<MutabakatDokumu> {
    return this.ekstre.mutabakat(id, principal);
  }

  @Get('ekstreler/:id/oneriler')
  @RequirePermission(IZINLER.FINANS_DEFTER_GORUNTULE)
  @ApiOperation({
    summary: 'Eşleştirme önerileri — HİÇBİR ŞEY YAZMAZ',
    description:
      'Önizleme ayrı bir uçtur çünkü kullanıcı neyin neyle eşleşeceğini ' +
      'görmeden onay veremez.\n\n' +
      'Sıra: (1) referans no tam eşleşmesi, (2) yön + tutar + tarih penceresi. ' +
      'Referans önce denenir çünkü banka dekont numarası tekildir.\n\n' +
      'BELİRSİZLİKTE aday DÖNMEZ (`hareketId: null`) ve `not` alanı nedeni ' +
      'söyler: "aday yok" ile "3 aday var, seçilemedi" farklı sorunlardır.',
  })
  oneriler(
    @Param('id') id: string,
    @AktifPrincipal() principal: Principal,
  ): Promise<readonly EslestirmeOnerisi[]> {
    return this.ekstre.oneriler(id, principal);
  }

  @Post('ekstreler/:id/otomatik-eslestir')
  @RequirePermission(IZINLER.FINANS_TAHSILAT)
  @ApiOperation({
    summary: 'Otomatik eşleştir — yalnızca TEK ADAYLI satırlar',
    description:
      'Bir satıra iki aday uyuyorsa HİÇBİRİ seçilmez. Makine tahmin ederse ' +
      'yanlış eşleşme mutabakatı SESSİZCE tamamlanmış gösterir; oysa ' +
      'mutabakatın bütün amacı farkı görünür kılmaktır.\n\n' +
      '`kalanEslesmeyen` ve `mutabikMi` YANITTA DÖNER: "otomatik eşleştirme ' +
      'tamamlandı" mesajı, geride 12 eşleşmemiş satır varken mutabakatın ' +
      'bittiği izlenimini verirdi.',
  })
  otomatikEslestir(
    @Param('id') id: string,
    @AktifPrincipal() principal: Principal,
  ): Promise<{
    readonly eslesen: number;
    readonly kalanEslesmeyen: number;
    readonly mutabikMi: boolean;
  }> {
    return this.ekstre.otomatikEslestir(id, principal);
  }

  @Post('ekstre-satirlari/:id/eslestir')
  @RequirePermission(IZINLER.FINANS_TAHSILAT)
  @ApiOperation({
    summary: 'Elle eşleştir',
    description:
      'Yön AYNI olmak zorundadır: girişi çıkışla eşleştirmek iki hatayı ' +
      'birbirine mahsup ederek ikisini de gizler.\n\n' +
      'Bir hareket İKİ satırla eşleşemez (veritabanı tekillik index\'i): ' +
      'eşleşseydi aynı para iki kez mutabık sayılır ve fark gizlenirdi.\n\n' +
      'Başka hesabın hareketi eşleştirilemez.',
  })
  eslestir(
    @Param('id') id: string,
    @Body() dto: EslestirDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.ekstre.eslestir(id, dto, principal);
  }

  @Delete('ekstre-satirlari/:id/eslestir')
  @RequirePermission(IZINLER.FINANS_TAHSILAT)
  @ApiOperation({
    summary: 'Eşleşmeyi kaldır',
    description:
      'Yanlış eşleştirmenin düzeltme yolu budur. Eşleşme "üzerine yazılarak" ' +
      'değiştirilmez: o zaman hangi hareketin serbest kaldığı denetim izinde ' +
      'görünmezdi. Fark gerekçesi de temizlenir.',
  })
  eslesmeyiKaldir(
    @Param('id') id: string,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.ekstre.eslesmeyiKaldir(id, principal);
  }

  @Post('ekstre-satirlari/:id/fark-kabul')
  @RequirePermission(IZINLER.FINANS_TAHSILAT)
  @ApiOperation({
    summary: 'Fark kabul — karşılığı bulunmayan satırı gerekçeyle kapat',
    description:
      'GEREKÇE ZORUNLUDUR (en az 10 karakter; veritabanı CHECK ile de ' +
      'zorlanır): bir farkı "kabul edildi" diye kapatmak, gerekçesi yazılmazsa ' +
      'denetimde açıklanamaz.\n\n' +
      'FARK_KABUL satırları özette AYRI SAYILIR ve eşleşmiş satırların içine ' +
      'karıştırılmaz.\n\n' +
      'Eşleşmiş satıra uygulanamaz: fark kabulü yalnızca karşılığı BULUNMAYAN ' +
      'satırlar için vardır.',
  })
  farkKabul(
    @Param('id') id: string,
    @Body() dto: FarkKabulDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.ekstre.farkKabul(id, dto, principal);
  }

  /* ----------------------------- Kıymetli evrak -------------------------- */

  @Get('kiymetli-evrak')
  @RequirePermission(IZINLER.FINANS_DEFTER_GORUNTULE)
  @ApiQuery({ name: 'tip', required: false, example: 'CEK' })
  @ApiQuery({ name: 'durum', required: false, example: 'TAHSILDE' })
  @ApiQuery({ name: 'vadeyeKadar', required: false, example: '2026-12-31' })
  @ApiOperation({
    summary: 'Çek ve senetler',
    description:
      'Çek ve senet aynı listede döner, `tip` ile ayrılır. `vadesiGecmisMi` ' +
      'KAPALI DURUMLARI dışlar: yalnızca `vadeTarihi <= bugün` denetimi ' +
      'yapılsaydı tahsil edilmiş çekler de "vadesi geçmiş" görünürdü.',
  })
  kiymetliEvrak(
    @AktifPrincipal() principal: Principal,
    @Query('tip') tip?: string,
    @Query('durum') durum?: string,
    @Query('vadeyeKadar') vadeyeKadar?: string,
  ): Promise<readonly EvrakSatiri[]> {
    return this.evrak.listele(principal, {
      ...(tip ? { tip } : {}),
      ...(durum ? { durum } : {}),
      ...(vadeyeKadar ? { vadeyeKadar } : {}),
    });
  }

  @Get('kiymetli-evrak/ozet')
  @RequirePermission(IZINLER.FINANS_DEFTER_GORUNTULE)
  @ApiOperation({
    summary: 'Çek/senet portföy özeti',
    description:
      'KAPALI DURUMLAR ÖZETTE YOKTUR: tahsil edilmiş ya da ciro edilmiş evrak ' +
      'artık beklenen bir tahsilat değildir ve toplama karışırsa alacak iki ' +
      'kez sayılır.',
  })
  evrakOzeti(@AktifPrincipal() principal: Principal): Promise<EvrakOzeti> {
    return this.evrak.ozet(principal);
  }

  @Post('kiymetli-evrak')
  @RequirePermission(IZINLER.FINANS_TAHSILAT)
  @ApiOperation({
    summary: 'Çek/senet ekle — PORTFOYDE olarak açılır',
    description:
      'Vade alış tarihinden önce olamaz: geçmiş vadeli bir çek zaten tahsil ' +
      'edilmiş ya da karşılıksız kalmıştır, portföye alınamaz.\n\n' +
      'Borçlu adı serbest metin olarak ZORUNLUDUR: dışarıdan gelen çekin ' +
      'borçlusunun kişi kaydı olmayabilir.',
  })
  evrakEkle(
    @Body() dto: KiymetliEvrakEkleDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.evrak.ekle(dto, principal);
  }

  @Post('kiymetli-evrak/:id/durum')
  @RequirePermission(IZINLER.FINANS_TAHSILAT)
  @ApiOperation({
    summary: 'Çek/senet durum geçişi — ATLAMA KABUL EDİLMEZ',
    description:
      'PORTFOYDE → TAHSILDE → TAHSIL_EDILDI | KARSILIKSIZ\n' +
      'KARSILIKSIZ → TAHSILDE (yeniden ibraz / yasal takip)\n' +
      'PORTFOYDE → CIRO_EDILDI | IADE_EDILDI\n\n' +
      'PORTFOYDE\'den doğrudan TAHSIL_EDILDI\'ye geçilemez: bankaya hiç ' +
      'verilmemiş bir çek tahsil edilmiş olamaz ve "tahsilde bekleyenler" ' +
      'listesi bir daha doğru olmazdı.\n\n' +
      'TAHSIL_EDILDI hesap ve tarih İSTER; KARSILIKSIZ ve IADE_EDILDI GEREKÇE ' +
      'ister. Bu kurallar hem domain hem veritabanı CHECK ile iki kez ' +
      'zorlanır — biri atlanırsa öteki tutar.',
  })
  evrakDurum(
    @Param('id') id: string,
    @Body() dto: EvrakDurumDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.evrak.durumGecisi(id, dto, principal);
  }

  /* ------------------------------ Parametreler --------------------------- */

  @Get('parametreler')
  @RequirePermission(IZINLER.FINANS_AYAR)
  @ApiOperation({
    summary: 'Banka parametreleri',
    description:
      'Kayıt yoksa VARSAYILANLAR döner (tolerans 0, pencere 3 gün); boş nesne ' +
      'arayüzü "yükleniyor" durumunda bırakırdı.',
  })
  parametreler(
    @AktifPrincipal() principal: Principal,
  ): Promise<BankaParametreGorunumu> {
    return this.parametre.oku(principal);
  }

  @Put('parametreler')
  @RequirePermission(IZINLER.FINANS_AYAR)
  @ApiOperation({
    summary: 'Banka parametrelerini kaydet',
    description:
      'Masraf ve komisyon hesapları GİDER tipinde ve FİŞ KESİLEBİLİR olmak ' +
      'zorundadır: gider olmayan bir hesaba masraf yazılırsa dönem sonucu ' +
      'sessizce yanlış çıkar.\n\n' +
      'MUTABAKAT TOLERANSI varsayılan olarak SIFIRDIR ve açılması denetime ' +
      'yazılır: makine kuruş farkını sessizce yutarsa gerçek bir eksik ' +
      'tahsilat mutabık görünür.',
  })
  parametreKaydet(
    @Body() dto: BankaParametreKaydetDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<{ readonly durum: string }> {
    return this.parametre.kaydet(dto, principal);
  }
}
