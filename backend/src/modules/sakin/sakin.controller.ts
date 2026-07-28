import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Principal } from '@bnos/kernel';
import { IZINLER } from '@bnos/core-domain';
import { AktifPrincipal, RequirePermission } from '../../common/decorators';
import { SakinCommandService } from './sakin.command.service';
import { SakinQueryService, type SakinSatiri } from './sakin.query.service';
import { SakinCikisDto, SakinEkleDto } from './dto/sakin.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

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
  ): Promise<KomutSonucu> {
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
