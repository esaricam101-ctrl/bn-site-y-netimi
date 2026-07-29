import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Principal } from '@bnos/kernel';
import { IZINLER } from '@bnos/core-domain';
import type { OtoparkDurumu } from '@bnos/apartman-domain';
import { AktifPrincipal, RequirePermission } from '../../common/decorators';
import { AracServisi, type AracSatiri } from './arac.service';
import { AracDuzeltDto, AracEkleDto, AracSonlandirDto } from './dto/arac.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

@ApiTags('Araç')
@ApiBearerAuth()
@Controller('araclar')
export class AracController {
  constructor(private readonly servis: AracServisi) {}

  @Get()
  @RequirePermission(IZINLER.BOLUM_GORUNTULE)
  @ApiQuery({ name: 'bolumId', required: false })
  @ApiQuery({ name: 'yalnizcaGecerli', required: false, type: Boolean })
  @ApiOperation({
    summary: 'Araçları listele',
    description:
      'Kayıtlar DÖNEMSELDİR: sonlandırılmış araçlar da döner ve `gecerliMi` ' +
      'ile işaretlenir. Geçmiş dönemin otopark dağıtımı bu tarihçeye dayanır.',
  })
  listele(
    @AktifPrincipal() principal: Principal,
    @Query('bolumId') bolumId?: string,
    @Query('yalnizcaGecerli') yalnizcaGecerli?: string,
  ): Promise<readonly AracSatiri[]> {
    return this.servis.listele(principal, {
      ...(bolumId ? { bolumId } : {}),
      ...(yalnizcaGecerli === 'true' ? { yalnizcaGecerli: true } : {}),
    });
  }

  @Post()
  @RequirePermission(IZINLER.BOLUM_YONET)
  @ApiOperation({
    summary: 'Araç kaydet',
    description:
      'Plaka normalize edilir ("34 ABC 123" = "34ABC123"). Aynı plaka aynı ' +
      'tarih aralığında TENANT GENELİNDE ikinci kez kaydedilemez: araç iki ' +
      'daireye sayılırsa otopark gideri fazla dağıtılır.',
  })
  ekle(
    @Body() dto: AracEkleDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.servis.ekle(dto, principal);
  }

  @Patch(':id')
  @RequirePermission(IZINLER.BOLUM_YONET)
  @ApiOperation({
    summary: 'Araç bilgisi düzelt',
    description:
      'Bölüm, kişi, plaka ve başlangıç DEĞİŞTİRİLEMEZ — dördü birlikte kaydın ' +
      'kimliğidir. Yanlış açılmış kayıt sonlandırılıp yenisi açılır; aksi halde ' +
      'geçmiş bir ayın otopark dağıtımı bugünkü düzeltmeyle sessizce değişir.',
  })
  duzelt(
    @Param('id') id: string,
    @Body() dto: AracDuzeltDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.servis.duzelt(id, dto, principal);
  }

  @Patch(':id/sonlandir')
  @RequirePermission(IZINLER.BOLUM_YONET)
  @ApiOperation({
    summary: 'Araç kaydını sonlandır',
    description: 'Kayıt SİLİNMEZ; dönem kapanır ve tarihçe korunur.',
  })
  sonlandir(
    @Param('id') id: string,
    @Body() dto: AracSonlandirDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.servis.sonlandir(id, dto, principal);
  }

  @Get('otopark/:bolumId')
  @RequirePermission(IZINLER.BOLUM_GORUNTULE)
  @ApiQuery({ name: 'hakSayisi', required: false, type: Number })
  @ApiOperation({
    summary: 'Bölümün otopark hak/kullanım durumu',
    description:
      'Aşımı ENGELLEMEZ, GÖRÜNÜR kılar: misafir aracı ya da geçici durumlar ' +
      'meşrudur ve yönetim kararı gerektirir.\n\n' +
      'TODO: `hakSayisi` şu an sorgu parametresidir; yönetim planındaki otopark ' +
      'hakkı henüz kalıcı bir alan değildir (ayrı migration gerekir).',
  })
  otopark(
    @Param('bolumId') bolumId: string,
    @AktifPrincipal() principal: Principal,
    @Query('hakSayisi') hakSayisi?: string,
  ): Promise<OtoparkDurumu> {
    const hak = Number(hakSayisi ?? '1');
    return this.servis.otoparkDurumu(
      bolumId, Number.isFinite(hak) && hak >= 0 ? hak : 1, principal,
    );
  }
}
