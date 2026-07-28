import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Principal } from '@bnos/kernel';
import { IZINLER } from '@bnos/core-domain';
import { AktifPrincipal, RequirePermission } from '../../common/decorators';
import { ApartmanCommandService } from './apartman.command.service';
import {
  ApartmanQueryService, type ApartmanSatiri, type HiyerarsiAgaci,
} from './apartman.query.service';
import { ApartmanGuncelleDto, ApartmanOlusturDto, ApartmanSilDto } from './dto/apartman.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

@ApiTags('Apartman')
@ApiBearerAuth()
@Controller('apartmanlar')
export class ApartmanController {
  constructor(
    private readonly command: ApartmanCommandService,
    private readonly query: ApartmanQueryService,
  ) {}

  @Post()
  @RequirePermission(IZINLER.BOLUM_YONET)
  @ApiOperation({
    summary: 'Apartman oluştur',
    description:
      'Hiyerarşinin tenant altındaki ilk katmanı (ADR-0008). Blok bir apartmana ' +
      'bağlı olmak zorundadır; üst kayıt olmadan alt kayıt oluşturulamaz.',
  })
  olustur(
    @Body() dto: ApartmanOlusturDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.command.olustur(dto, principal);
  }

  @Get()
  @RequirePermission(IZINLER.BOLUM_GORUNTULE)
  @ApiOperation({ summary: 'Apartmanları listele (blok sayısıyla)' })
  listele(@AktifPrincipal() principal: Principal): Promise<readonly ApartmanSatiri[]> {
    return this.query.listele(principal);
  }

  @Get(':id')
  @RequirePermission(IZINLER.BOLUM_GORUNTULE)
  @ApiOperation({ summary: 'Apartman detayı' })
  detay(
    @Param('id') id: string,
    @AktifPrincipal() principal: Principal,
  ): Promise<ApartmanSatiri> {
    return this.query.detay(id, principal);
  }

  @Get(':id/hiyerarsi')
  @RequirePermission(IZINLER.BOLUM_GORUNTULE)
  @ApiOperation({
    summary: 'Apartmanın tüm hiyerarşisi (Blok → Kat → Bölüm)',
    description:
      'Yönetim ekranı gezinmesi için tek çağrı. Kata bağlanmamış bölümler ' +
      '`katsizBolumler` altında AYRI döner — gizlenirse bölüm sayısı tutmaz ' +
      've eksik veri fark edilmez.',
  })
  hiyerarsi(
    @Param('id') id: string,
    @AktifPrincipal() principal: Principal,
  ): Promise<HiyerarsiAgaci> {
    return this.query.hiyerarsi(id, principal);
  }

  @Patch(':id')
  @RequirePermission(IZINLER.BOLUM_YONET)
  @ApiOperation({
    summary: 'Apartmanı güncelle',
    description: 'Kısmi güncelleme: yalnızca gönderilen alanlar değişir.',
  })
  guncelle(
    @Param('id') id: string,
    @Body() dto: ApartmanGuncelleDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.command.guncelle(id, dto, principal);
  }

  @Delete(':id')
  @RequirePermission(IZINLER.BOLUM_YONET)
  @ApiOperation({
    summary: 'Apartmanı soft-delete et',
    description: 'Gerekçe zorunludur. Bloğu olan apartman silinemez.',
  })
  sil(
    @Param('id') id: string,
    @Body() dto: ApartmanSilDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.command.softSil(id, dto.gerekce, principal);
  }
}
