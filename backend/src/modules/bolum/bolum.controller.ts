import { Body, Controller, DefaultValuePipe, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Principal } from '@bnos/kernel';
import { IZINLER } from '@bnos/core-domain';
import type { BolumDurumu, BolumNiteligi } from '@bnos/apartman-domain';
import { AktifPrincipal, RequirePermission } from '../../common/decorators';
import { BolumCommandService, type TopluSonuc } from './bolum.command.service';
import {
  BolumQueryService,
  type ArsaPayiRaporu, type BolumSatiri, type HisseDenetimi,
  type HiyerarsiDenetimi, type YerlesimOzeti,
} from './bolum.query.service';
import {
  BOLUM_DURUMLARI, BOLUM_NITELIKLERI,
  ArsaPayiDuzeltDto, BolumGuncelleDto, BolumOlusturDto, BolumSilDto, BolumTasiDto,
  TopluBolumOlusturDto,
} from './dto/bolum.dto';
import type { SayfaliSonuc } from '../kisi/kisi.query.service';
import type { KomutSonucu } from '../tenant/tenant.command.service';

@ApiTags('Bağımsız Bölüm')
@ApiBearerAuth()
@Controller('bolumler')
export class BolumController {
  constructor(
    private readonly command: BolumCommandService,
    private readonly query: BolumQueryService,
  ) {}

  @Post()
  @RequirePermission(IZINLER.BOLUM_YONET)
  @ApiOperation({
    summary: 'Bağımsız bölüm oluştur',
    description:
      'Arsa payı pay/payda olarak METİN gönderilir — JSON number float olduğu için ' +
      'payların toplamı KMK md. 3\'ün şart koştuğu tamı tutmaz.',
  })
  olustur(
    @Body() dto: BolumOlusturDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.command.olustur(dto, principal);
  }

  @Get()
  @RequirePermission(IZINLER.BOLUM_GORUNTULE)
  @ApiQuery({ name: 'apartmanId', required: false, description: 'Blok üzerinden dolaylı süzer.' })
  @ApiQuery({ name: 'blokId', required: false })
  @ApiQuery({ name: 'katId', required: false })
  @ApiQuery({ name: 'durum', required: false, enum: BOLUM_DURUMLARI })
  @ApiQuery({ name: 'nitelik', required: false, enum: BOLUM_NITELIKLERI })
  @ApiOperation({
    summary: 'Bağımsız bölümleri listele (cursor sayfalama + hiyerarşi süzgeçleri)',
    description: 'Süzgeçler birleşir: `blokId` + `durum` aynı anda verilebilir.',
  })
  listele(
    @AktifPrincipal() principal: Principal,
    @Query('imlec') imlec?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
    @Query('apartmanId') apartmanId?: string,
    @Query('blokId') blokId?: string,
    @Query('katId') katId?: string,
    @Query('durum') durum?: BolumDurumu,
    @Query('nitelik') nitelik?: BolumNiteligi,
  ): Promise<SayfaliSonuc<BolumSatiri>> {
    const temizLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50;
    return this.query.listele(principal, imlec, temizLimit, {
      ...(apartmanId ? { apartmanId } : {}),
      ...(blokId ? { blokId } : {}),
      ...(katId ? { katId } : {}),
      ...(durum ? { durum } : {}),
      ...(nitelik ? { nitelik } : {}),
    });
  }

  @Get('hisse-denetimi')
  @RequirePermission(IZINLER.BOLUM_GORUNTULE)
  @ApiQuery({ name: 'tarih', required: false, description: 'Varsayılan: bugün.' })
  @ApiOperation({
    summary: 'BİNA GENELİ hisse denetimi (tahakkuk öncesi kapı)',
    description:
      '`malikler/hisse-durumu` tek bölümü denetler; kırk daireli binada kırk çağrı ' +
      'gerekirdi. Bu uç yalnızca SORUNLU bölümleri döndürür.\n\n' +
      'Hisse toplamı tamı etmeyen bölümde tahakkuk yapılamaz: eksikse payın bir ' +
      'kısmı hiçbir kişiye yazılmaz, fazlaysa aynı tutar iki kez istenir.',
  })
  hisseDenetimi(
    @AktifPrincipal() principal: Principal,
    @Query('tarih') tarih?: string,
  ): Promise<HisseDenetimi> {
    return this.query.hisseDenetimi(principal, tarih);
  }

  @Get('yerlesim-ozeti')
  @RequirePermission(IZINLER.BOLUM_GORUNTULE)
  @ApiQuery({ name: 'tarih', required: false, description: 'Varsayılan: bugün.' })
  @ApiOperation({
    summary: 'Bina geneli yerleşim özeti — kim oturuyor, hangi daire boş',
    description:
      'Yönetim ekranının ana tablosu: her bölüm için malik sayısı, hisse tamlığı, ' +
      'kira durumu ve sakin sayısı tek sorguda. Daire kartını bölüm bölüm ' +
      'çağırmak kırk daire için kırk istek demektir.',
  })
  yerlesimOzeti(
    @AktifPrincipal() principal: Principal,
    @Query('tarih') tarih?: string,
  ): Promise<YerlesimOzeti> {
    return this.query.yerlesimOzeti(principal, tarih);
  }

  @Get('hiyerarsi-denetimi')
  @RequirePermission(IZINLER.BOLUM_GORUNTULE)
  @ApiOperation({
    summary: 'Hiyerarşiyi uçtan uca denetle',
    description:
      'Apartman → Blok → Kat → Bölüm zincirindeki tutarsızlıkları raporlar. ' +
      'Oluşturma anında zorlanan kurallar MEVCUT veride bozuk kalmış olabilir; ' +
      'kontroller sonradan eklendi. Yalnızca rapor üretir, veriyi DÜZELTMEZ.',
  })
  hiyerarsiDenetimi(@AktifPrincipal() principal: Principal): Promise<HiyerarsiDenetimi> {
    return this.query.hiyerarsiDenetimi(principal);
  }

  @Get('arsa-payi-durumu')
  @RequirePermission(IZINLER.BOLUM_GORUNTULE)
  @ApiOperation({
    summary: 'Arsa payı toplamını denetle (KMK md. 3)',
    description:
      'Arsa paylarının toplamı tamı etmelidir. Sapma varsa yönetim planı hatalıdır ' +
      've tahakkuk çalıştırılmamalıdır.',
  })
  arsaPayiDurumu(@AktifPrincipal() principal: Principal): Promise<ArsaPayiRaporu> {
    return this.query.arsaPayiDurumu(principal);
  }

  @Post('toplu')
  @RequirePermission(IZINLER.BOLUM_YONET)
  @ApiOperation({
    summary: 'Bölümleri toplu oluştur',
    description:
      'Kırk daireli bir binayı tek tek girmek operasyonel olarak kullanılamaz. ' +
      'Hiyerarşi (blok/kat) tüm satırlar için ortaktır. Tek işlem: bir satır ' +
      'geçersizse hiçbiri yazılmaz — yarım girilmiş bir kat, arsa payı toplamını ' +
      'da yarım bırakır ve neyin eksik olduğu görünmez.\n\n' +
      'Arsa payı toplamı burada DENETLENMEZ; bina parça parça girilirken toplam ' +
      'doğal olarak 1’in altındadır. Tamlık `arsa-payi-durumu` ile denetlenir.',
  })
  topluOlustur(
    @Body() dto: TopluBolumOlusturDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<TopluSonuc> {
    return this.command.topluOlustur(dto, principal);
  }

  @Post('tasi')
  @RequirePermission(IZINLER.BOLUM_YONET)
  @ApiOperation({
    summary: 'Bölümleri başka blok/kata taşı (TOPLU)',
    description:
      'Hiyerarşi denetiminin raporladığı KAT_BLOK_UYUSMAZLIGI, KATSIZ_BLOK, ' +
      'BLOKSUZ_KAT ve HIYERARSI_DISI sorunlarının düzeltme akışı. Tek işlem: ' +
      'biri başarısız olursa hiçbiri taşınmaz — yarım kalan taşıma hiyerarşiyi ' +
      'denetimin bulduğundan daha bozuk bırakırdı.\n\n' +
      '`hedefKatId` verilirse bölümün `kat` alanı katın numarasıyla EŞİTLENİR.',
  })
  tasi(
    @Body() dto: BolumTasiDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<TopluSonuc> {
    return this.command.tasi(dto, principal);
  }

  @Post('arsa-payi-duzelt')
  @RequirePermission(IZINLER.BOLUM_YONET)
  @ApiOperation({
    summary: 'Arsa paylarını toplu düzelt (KMK md. 3)',
    description:
      'Tek bölümün arsa payını değiştirmek binanın toplamını sessizce bozar; bu ' +
      'yüzden `PATCH /bolumler/:id` arsa payına dokunmaz.\n\n' +
      'Burada işlem SONUNDAKİ toplam hesaplanır — gönderilen satırlar + ' +
      'DOKUNULMAYAN bölümler. Toplam tamı etmiyorsa hiçbir satır yazılmaz.',
  })
  arsaPayiDuzelt(
    @Body() dto: ArsaPayiDuzeltDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<TopluSonuc> {
    return this.command.arsaPayiDuzelt(dto, principal);
  }

  @Get(':id')
  @RequirePermission(IZINLER.BOLUM_GORUNTULE)
  @ApiOperation({ summary: 'Bağımsız bölüm detayı' })
  detay(
    @Param('id') id: string,
    @AktifPrincipal() principal: Principal,
  ): Promise<BolumSatiri> {
    return this.query.detay(id, principal);
  }

  @Patch(':id')
  @RequirePermission(IZINLER.BOLUM_YONET)
  @ApiOperation({
    summary: 'Bağımsız bölümü güncelle',
    description:
      'ARSA PAYI ve BLOK/KAT burada değiştirilemez. Arsa payı KMK md. 3 toplamını ' +
      'etkiler; tek bölümde değiştirmek binanın toplamını sessizce bozar.',
  })
  guncelle(
    @Param('id') id: string,
    @Body() dto: BolumGuncelleDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.command.guncelle(id, dto, principal);
  }

  @Delete(':id')
  @RequirePermission(IZINLER.BOLUM_YONET)
  @ApiOperation({
    summary: 'Bağımsız bölümü soft-delete et',
    description:
      'Gerekçe zorunludur. Açık borcu olan bölüm silinemez — borç bölüme bağlıdır, ' +
      'kişiye değil (ADR v1.1 §5).',
  })
  sil(
    @Param('id') id: string,
    @Body() dto: BolumSilDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.command.softSil(id, dto.gerekce, principal);
  }
}
