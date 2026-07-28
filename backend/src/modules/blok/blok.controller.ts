import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Principal } from '@bnos/kernel';
import { IZINLER } from '@bnos/core-domain';
import { AktifPrincipal, RequirePermission } from '../../common/decorators';
import { BlokCommandService } from './blok.command.service';
import { BlokQueryService, type BlokSatiri } from './blok.query.service';
import { BlokGuncelleDto, BlokOlusturDto, BlokSilDto } from './dto/blok.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

@ApiTags('Blok')
@ApiBearerAuth()
@Controller('bloklar')
export class BlokController {
  constructor(
    private readonly command: BlokCommandService,
    private readonly query: BlokQueryService,
  ) {}

  @Post()
  @RequirePermission(IZINLER.BOLUM_YONET)
  @ApiOperation({
    summary: 'Blok oluştur',
    description: 'Tek bloklu apartmanlarda blok kaydı gerekmez; bölümler bloksuz açılabilir.',
  })
  olustur(
    @Body() dto: BlokOlusturDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.command.olustur(dto, principal);
  }

  @Get()
  @RequirePermission(IZINLER.BOLUM_GORUNTULE)
  @ApiQuery({ name: 'apartmanId', required: false, description: 'Verilirse yalnızca o apartmanın blokları.' })
  @ApiOperation({ summary: 'Blokları listele (kat ve bölüm sayısıyla)' })
  listele(
    @AktifPrincipal() principal: Principal,
    @Query('apartmanId') apartmanId?: string,
  ): Promise<readonly BlokSatiri[]> {
    return this.query.listele(principal, apartmanId);
  }

  @Get(':id')
  @RequirePermission(IZINLER.BOLUM_GORUNTULE)
  @ApiOperation({ summary: 'Blok detayı' })
  detay(
    @Param('id') id: string,
    @AktifPrincipal() principal: Principal,
  ): Promise<BlokSatiri> {
    return this.query.detay(id, principal);
  }

  @Patch(':id')
  @RequirePermission(IZINLER.BOLUM_YONET)
  @ApiOperation({
    summary: 'Bloğu güncelle',
    description: 'Blok başka bir apartmana taşınmaz; hiyerarşi sabittir.',
  })
  guncelle(
    @Param('id') id: string,
    @Body() dto: BlokGuncelleDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.command.guncelle(id, dto, principal);
  }

  @Delete(':id')
  @RequirePermission(IZINLER.BOLUM_YONET)
  @ApiOperation({
    summary: 'Bloğu soft-delete et',
    description: 'Gerekçe zorunludur. Bağımsız bölümü olan blok silinemez.',
  })
  sil(
    @Param('id') id: string,
    @Body() dto: BlokSilDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.command.softSil(id, dto.gerekce, principal);
  }
}
