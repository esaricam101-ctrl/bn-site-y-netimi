import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Principal } from '@bnos/kernel';
import { IZINLER } from '@bnos/core-domain';
import { AktifPrincipal, RequirePermission } from '../../common/decorators';
import { SakinCommandService } from './sakin.command.service';
import { SakinQueryService, type SakinSatiri } from './sakin.query.service';
import { SakinCikisDto, SakinDuzeltDto, SakinEkleDto } from './dto/sakin.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';
import type { HizliKayitSonucu } from '../../common/kayit/hizli-kayit';

@ApiTags('Sakin')
@ApiBearerAuth()
@Controller('bolumler/:bolumId/sakinler')
export class SakinController {
  constructor(
    private readonly command: SakinCommandService,
    private readonly query: SakinQueryService,
  ) {}

  @Post()
  @RequirePermission(IZINLER.BOLUM_YONET)
  @ApiOperation({
    summary: 'Bölüme sakin ekle',
    description:
      'Sakin, kiracı DEĞİLDİR: malik oturabilir, kiracı oturmayıp ailesi oturabilir, ' +
      'kiracı dışında sakinler bulunabilir. Bir bölümde aynı anda birden çok sakin ' +
      'geçerlidir. Sakin kaydı borç sorumluluğu DOĞURMAZ.',
  })
  ekle(
    @Param('bolumId') bolumId: string,
    @Body() dto: SakinEkleDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<HizliKayitSonucu> {
    return this.command.ekle(bolumId, dto, principal);
  }

  @Get()
  @RequirePermission(IZINLER.BOLUM_GORUNTULE)
  @ApiQuery({
    name: 'tarih', required: false,
    description: 'Verilirse o gün oturanlar; verilmezse TÜM yerleşim tarihçesi.',
  })
  @ApiOperation({
    summary: 'Bölümde oturanlar ve yerleşim tarihçesi',
    description: 'Çıkmış sakinler silinmez; `gecerliMi: false` ile döner.',
  })
  listele(
    @Param('bolumId') bolumId: string,
    @AktifPrincipal() principal: Principal,
    @Query('tarih') tarih?: string,
  ): Promise<readonly SakinSatiri[]> {
    return this.query.listele(bolumId, principal, tarih);
  }

  @Patch(':sakinId')
  @RequirePermission(IZINLER.BOLUM_YONET)
  @ApiOperation({
    summary: 'Sakin bilgisini düzelt',
    description:
      'KİŞİ değiştirilemez — kaydın kimliğidir. Yanlış kişi girildiyse çıkış ' +
      'verilip doğru kişiyle yeni kayıt açılır.',
  })
  duzelt(
    @Param('bolumId') bolumId: string,
    @Param('sakinId') sakinId: string,
    @Body() dto: SakinDuzeltDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.command.duzelt(bolumId, sakinId, dto, principal);
  }

  @Patch(':sakinId/cikis')
  @RequirePermission(IZINLER.BOLUM_YONET)
  @ApiOperation({
    summary: 'Sakine çıkış ver',
    description: 'Dönem kapanır, kayıt SİLİNMEZ — yerleşim tarihçesi korunur.',
  })
  cikisVer(
    @Param('bolumId') bolumId: string,
    @Param('sakinId') sakinId: string,
    @Body() dto: SakinCikisDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.command.cikisVer(bolumId, sakinId, dto.cikisTarihi, principal);
  }
}
