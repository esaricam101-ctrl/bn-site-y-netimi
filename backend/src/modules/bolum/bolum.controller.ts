import { Body, Controller, DefaultValuePipe, Delete, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Principal } from '@bnos/kernel';
import { IZINLER } from '@bnos/core-domain';
import { AktifPrincipal, RequirePermission } from '../../common/decorators';
import { BolumCommandService } from './bolum.command.service';
import { BolumQueryService, type ArsaPayiRaporu, type BolumSatiri } from './bolum.query.service';
import { BolumOlusturDto, BolumSilDto } from './dto/bolum.dto';
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
  @ApiOperation({ summary: 'Bağımsız bölümleri listele (cursor sayfalama)' })
  listele(
    @AktifPrincipal() principal: Principal,
    @Query('imlec') imlec?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
  ): Promise<SayfaliSonuc<BolumSatiri>> {
    const temizLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50;
    return this.query.listele(principal, imlec, temizLimit);
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
