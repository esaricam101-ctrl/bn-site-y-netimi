import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Principal } from '@bnos/kernel';
import { IZINLER } from '@bnos/core-domain';
import { AktifPrincipal, RequirePermission } from '../../common/decorators';
import { MalikCommandService } from './malik.command.service';
import { MalikQueryService, type HisseRaporu, type MalikSatiri } from './malik.query.service';
import { MalikDevretDto, MalikDuzeltDto, MalikEkleDto } from './dto/malik.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';
import type { HizliKayitSonucu } from '../../common/kayit/hizli-kayit';

@ApiTags('Malik')
@ApiBearerAuth()
@Controller('bolumler/:bolumId/malikler')
export class MalikController {
  constructor(
    private readonly command: MalikCommandService,
    private readonly query: MalikQueryService,
  ) {}

  @Post()
  @RequirePermission(IZINLER.BOLUM_YONET)
  @ApiOperation({
    summary: 'Bölüme hisseli malik ekle',
    description:
      'Bir bölümde birden çok malik bulunabilir. Hisse pay/payda olarak METİN ' +
      'gönderilir; JSON number float olduğu için üç eşit hissede toplam asla ' +
      '%100 etmez. Toplamın 1’i AŞMASI reddedilir; altında kalması eksik ' +
      'kayıttır ve tahakkuk öncesi `hisse-durumu` ile denetlenir.',
  })
  ekle(
    @Param('bolumId') bolumId: string,
    @Body() dto: MalikEkleDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<HizliKayitSonucu> {
    return this.command.ekle(bolumId, dto, principal);
  }

  @Get()
  @RequirePermission(IZINLER.BOLUM_GORUNTULE)
  @ApiQuery({
    name: 'tarih', required: false,
    description: 'Verilirse o gün geçerli malikler; verilmezse TÜM tarihçe.',
  })
  @ApiOperation({
    summary: 'Bölümün malikleri ve tapu tarihçesi',
    description: 'Geçmiş malik kayıtları silinmez; `gecerliMi: false` ile döner.',
  })
  listele(
    @Param('bolumId') bolumId: string,
    @AktifPrincipal() principal: Principal,
    @Query('tarih') tarih?: string,
  ): Promise<readonly MalikSatiri[]> {
    return this.query.listele(bolumId, principal, tarih);
  }

  @Get('hisse-durumu')
  @RequirePermission(IZINLER.BOLUM_GORUNTULE)
  @ApiQuery({ name: 'tarih', required: false, description: 'Varsayılan: bugün.' })
  @ApiOperation({
    summary: 'Hisse toplamını denetle (%100 kontrolü)',
    description:
      'Tahakkuk öncesi kontrol noktası. Eksik hisse, bölümün bir kısmının ' +
      'sahipsiz olması ve o payın hiçbir kişiye tahakkuk etmemesi demektir.',
  })
  hisseDurumu(
    @Param('bolumId') bolumId: string,
    @AktifPrincipal() principal: Principal,
    @Query('tarih') tarih?: string,
  ): Promise<HisseRaporu> {
    return this.query.hisseDurumu(bolumId, principal, tarih);
  }

  @Patch(':malikId')
  @RequirePermission(IZINLER.BOLUM_YONET)
  @ApiOperation({
    summary: 'Malik kaydını düzelt (yazım hatası · vekâlet)',
    description:
      'HİSSE ORANI burada DEĞİŞTİRİLEMEZ. Hisse değişikliği bir devirdir: eski ' +
      'oran bir döneme, yeni oran başka bir döneme aittir. Kaydı yerinde ' +
      'güncellemek geçmiş tahakkukların dayanağını sessizce değiştirir — Şubat ' +
      'borcu 1/2 hisseye göre yazılmışken kayıt 1/3’e çevrilirse borç artık ' +
      'hiçbir orana karşılık gelmez. Doğru akış: `devret` ile kapat, yeni oranla ' +
      'yeni kayıt aç.',
  })
  duzelt(
    @Param('bolumId') bolumId: string,
    @Param('malikId') malikId: string,
    @Body() dto: MalikDuzeltDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.command.duzelt(bolumId, malikId, dto, principal);
  }

  @Patch(':malikId/devret')
  @RequirePermission(IZINLER.BOLUM_YONET)
  @ApiOperation({
    summary: 'Tapu dönemini kapat (devir/satış)',
    description:
      'Kayıt SİLİNMEZ, dönemi kapanır. Borç sorumluluğu borcun oluştuğu anda ' +
      'çözülüp yazılır; geçmiş tapu kaydını silmek o borcun dayanağını yok eder.',
  })
  devret(
    @Param('bolumId') bolumId: string,
    @Param('malikId') malikId: string,
    @Body() dto: MalikDevretDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.command.devret(bolumId, malikId, dto.tapuBitis, principal);
  }
}
