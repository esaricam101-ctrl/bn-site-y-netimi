import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Principal } from '@bnos/kernel';
import { IZINLER } from '@bnos/core-domain';
import { AktifPrincipal, RequirePermission } from '../../common/decorators';
import { MisafirServisi, type MisafirSatiri } from './misafir.service';
import {
  MisafirCikisDto, MisafirDuzeltDto, MisafirEkleDto, MisafirSilDto,
} from './dto/misafir.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

/**
 * Misafirler — bağımsız bölümü ziyaret eden kişiler.
 *
 * ⚠️  MİSAFİR HAK SAHİBİ DEĞİLDİR: borç sorumlusu olmaz, tahakkuka girmez,
 *     arsa payı taşımaz. `Kisi` kaydı açılmaz; bilgiler misafir kaydının
 *     içindedir. Malik · kiracı · sakin modüllerine dokunmaz.
 */
@ApiTags('Misafir')
@ApiBearerAuth()
@Controller('misafirler')
export class MisafirController {
  constructor(private readonly servis: MisafirServisi) {}

  @Get()
  @RequirePermission(IZINLER.KISI_GORUNTULE)
  @ApiQuery({ name: 'bolumId', required: false })
  @ApiQuery({
    name: 'icerideMi', required: false, example: 'true',
    description: 'true → çıkış yapmamışlar, false → çıkmışlar.',
  })
  @ApiQuery({ name: 'arama', required: false })
  @ApiOperation({ summary: 'Misafirleri listele' })
  listele(
    @AktifPrincipal() principal: Principal,
    @Query('bolumId') bolumId?: string,
    @Query('icerideMi') icerideMi?: string,
    @Query('arama') arama?: string,
  ): Promise<readonly MisafirSatiri[]> {
    return this.servis.listele(principal, {
      ...(bolumId ? { bolumId } : {}),
      ...(icerideMi === undefined ? {} : { icerideMi: icerideMi === 'true' }),
      ...(arama ? { arama } : {}),
    });
  }

  @Get('iceride')
  @RequirePermission(IZINLER.KISI_GORUNTULE)
  @ApiOperation({
    summary: 'Hâlen içeride olan misafirler',
    description:
      'Çıkış tarihi girilmemiş kayıtlar. Güvenlik ve tahliye listesi bu uca ' +
      'dayanır; bu yüzden ayrı bir uç olarak durur.',
  })
  iceride(@AktifPrincipal() principal: Principal): Promise<readonly MisafirSatiri[]> {
    return this.servis.icerideOlanlar(principal);
  }

  @Get(':id')
  @RequirePermission(IZINLER.KISI_GORUNTULE)
  @ApiOperation({ summary: 'Misafir kartı' })
  detay(
    @Param('id') id: string,
    @AktifPrincipal() principal: Principal,
  ): Promise<MisafirSatiri> {
    return this.servis.detay(id, principal);
  }

  @Post()
  @RequirePermission(IZINLER.KISI_YONET)
  @ApiOperation({
    summary: 'Misafir ekle — tek ekrandan hızlı kayıt',
    description:
      'Kişi bilgileri, ziyaret bilgileri ve araç plakaları AYNI İŞLEMDE ' +
      'yazılır. Kişi seçme zorunluluğu yoktur ve `kisi` kaydı OLUŞTURULMAZ: ' +
      'misafir hak sahibi değildir ve verisi kısa ömürlüdür (KVKK).\n\n' +
      '`cikisTarihi` boş bırakılırsa misafir hâlen içeride sayılır.',
  })
  ekle(
    @Body() dto: MisafirEkleDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu & { readonly plakaSayisi: number }> {
    return this.servis.ekle(dto, principal);
  }

  @Patch(':id')
  @RequirePermission(IZINLER.KISI_YONET)
  @ApiOperation({
    summary: 'Misafir bilgisi düzelt',
    description:
      '`bolumId` ve `girisTarihi` DEĞİŞTİRİLEMEZ: ikisi birlikte ziyaretin ' +
      'kimliğidir. Yanlış girilmişse kayıt arşivlenip yenisi açılır.',
  })
  duzelt(
    @Param('id') id: string,
    @Body() dto: MisafirDuzeltDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.servis.duzelt(id, dto, principal);
  }

  @Patch(':id/cikis')
  @RequirePermission(IZINLER.KISI_YONET)
  @ApiOperation({
    summary: 'Çıkış işle',
    description:
      'Misafirin AÇIK ARAÇ KAYITLARI da aynı tarihte kapatılır; yanıtta ' +
      '`kapatilanAracSayisi` döner. Kapatılmasaydı çıkmış misafirin aracı ' +
      'otopark sayımında yer kaplamaya devam ederdi.',
  })
  cikis(
    @Param('id') id: string,
    @Body() dto: MisafirCikisDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu & { readonly kapatilanAracSayisi: number }> {
    return this.servis.cikis(id, dto, principal);
  }

  @Delete(':id')
  @RequirePermission(IZINLER.KISI_YONET)
  @ApiOperation({
    summary: 'Misafir kaydını arşivle (soft delete)',
    description:
      'Gerekçe zorunludur. Ziyaretin sona ermesi için bu uç DEĞİL `/cikis` ' +
      'kullanılır.',
  })
  sil(
    @Param('id') id: string,
    @Body() dto: MisafirSilDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.servis.softSil(id, dto.gerekce, principal);
  }
}
