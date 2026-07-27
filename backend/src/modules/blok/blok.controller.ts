import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Principal } from '@bnos/kernel';
import { IZINLER } from '@bnos/core-domain';
import { AktifPrincipal, RequirePermission } from '../../common/decorators';
import { BlokCommandService } from './blok.command.service';
import { BlokQueryService, type BlokSatiri } from './blok.query.service';
import { BlokOlusturDto, BlokSilDto } from './dto/blok.dto';
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
  @ApiOperation({ summary: 'Blokları listele (bölüm sayısıyla)' })
  listele(@AktifPrincipal() principal: Principal): Promise<readonly BlokSatiri[]> {
    return this.query.listele(principal);
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
