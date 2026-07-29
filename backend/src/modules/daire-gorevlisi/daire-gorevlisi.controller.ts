import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Principal } from '@bnos/kernel';
import { IZINLER } from '@bnos/core-domain';
import { AktifPrincipal, RequirePermission } from '../../common/decorators';
import { DaireGorevlisiServisi, type GorevliSatiri } from './daire-gorevlisi.service';
import {
  GorevliAyrilDto, GorevliDuzeltDto, GorevliEkleDto, GorevliSilDto,
  SertifikaEkleDto, ZimmetEkleDto, ZimmetIadeDto,
} from './dto/daire-gorevlisi.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

/**
 * Daire görevlileri — sitede/apartmanda görev yapan görevli.
 *
 * MALİK · KİRACI · SAKİN modüllerinden tümüyle AYRIDIR ve onlara dokunmaz.
 * Görevli bir istihdam kaydıdır; malik/kiracı/sakin ise bağımsız bölüme
 * bağlı hak sahipliği kayıtlarıdır.
 */
@ApiTags('Daire Görevlisi')
@ApiBearerAuth()
@Controller('daire-gorevlileri')
export class DaireGorevlisiController {
  constructor(private readonly servis: DaireGorevlisiServisi) {}

  @Get()
  @RequirePermission(IZINLER.KISI_GORUNTULE)
  @ApiQuery({ name: 'gorev', required: false })
  @ApiQuery({ name: 'durum', required: false, example: 'AKTIF' })
  @ApiQuery({ name: 'apartmanId', required: false })
  @ApiQuery({ name: 'arama', required: false })
  @ApiOperation({
    summary: 'Görevlileri listele',
    description:
      'Her satır sertifikaları, zimmetleri, açık zimmet sayısı ve süresi ' +
      'dolmuş sertifika sayısıyla döner.',
  })
  listele(
    @AktifPrincipal() principal: Principal,
    @Query('gorev') gorev?: string,
    @Query('durum') durum?: string,
    @Query('apartmanId') apartmanId?: string,
    @Query('arama') arama?: string,
  ): Promise<readonly GorevliSatiri[]> {
    return this.servis.listele(principal, {
      ...(gorev ? { gorev } : {}),
      ...(durum ? { durum } : {}),
      ...(apartmanId ? { apartmanId } : {}),
      ...(arama ? { arama } : {}),
    });
  }

  @Get('sertifikasi-dolanlar')
  @RequirePermission(IZINLER.KISI_GORUNTULE)
  @ApiOperation({
    summary: 'Sertifikası süresi dolmuş AKTİF görevli',
    description:
      'Süresi geçmiş güvenlik sertifikasıyla çalıştırmak idari yaptırım ' +
      'sebebidir; bu ancak takip edilirse görülür.',
  })
  sertifikasiDolanlar(
    @AktifPrincipal() principal: Principal,
  ): Promise<readonly GorevliSatiri[]> {
    return this.servis.sertifikasiDolanlar(principal);
  }

  @Get(':id')
  @RequirePermission(IZINLER.KISI_GORUNTULE)
  @ApiOperation({ summary: 'Görevli kartı' })
  detay(
    @Param('id') id: string,
    @AktifPrincipal() principal: Principal,
  ): Promise<GorevliSatiri> {
    return this.servis.detay(id, principal);
  }

  @Post()
  @RequirePermission(IZINLER.KISI_YONET)
  @ApiOperation({
    summary: 'Görevli ekle',
    description:
      'Aynı TC kimlik numarasıyla AKTİF ikinci kayıt açılamaz — mükerrer ' +
      'görevli bordroyu ikiye katlar. Ayrılmış kayıt engellemez: aynı kişi ' +
      'tekrar işe alınabilir.',
  })
  ekle(
    @Body() dto: GorevliEkleDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.servis.ekle(dto, principal);
  }

  @Patch(':id')
  @RequirePermission(IZINLER.KISI_YONET)
  @ApiOperation({
    summary: 'Görevli bilgisi düzelt',
    description:
      '`iseGirisTarihi` DEĞİŞTİRİLEMEZ: kıdem ve SGK bildirimleri bu tarihe ' +
      'dayanır. Yanlış girilmişse kayıt kapatılıp yenisi açılır.',
  })
  duzelt(
    @Param('id') id: string,
    @Body() dto: GorevliDuzeltDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.servis.duzelt(id, dto, principal);
  }

  @Patch(':id/ayril')
  @RequirePermission(IZINLER.KISI_YONET)
  @ApiOperation({
    summary: 'İşten ayrılış — kayıt kapanır, silinmez',
    description:
      'Durum aynı işlemde PASIF olur; ayrılmış görevlinin AKTİF kalması ' +
      'veritabanı kısıtıyla reddedilir.\n\n' +
      'AÇIK ZİMMET ENGELLEMEZ, UYARIR: yanıtta `acikZimmetSayisi` döner. ' +
      'Engellemek, kaydı hiç kapatmamaya ve aktif görevli listesinin ' +
      'bozulmasına yol açardı.',
  })
  ayril(
    @Param('id') id: string,
    @Body() dto: GorevliAyrilDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu & { readonly acikZimmetSayisi: number }> {
    return this.servis.ayril(id, dto, principal);
  }

  @Delete(':id')
  @RequirePermission(IZINLER.KISI_YONET)
  @ApiOperation({
    summary: 'Görevli kaydını arşivle (soft delete)',
    description:
      'Gerekçe zorunludur. İşten ayrılış için bu uç DEĞİL `/ayril` kullanılır: ' +
      'ayrılış normal bir yaşam döngüsü olayıdır, silme ise hatalı kayıt içindir.',
  })
  sil(
    @Param('id') id: string,
    @Body() dto: GorevliSilDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.servis.softSil(id, dto.gerekce, principal);
  }

  @Post(':id/sertifikalar')
  @RequirePermission(IZINLER.KISI_YONET)
  @ApiOperation({ summary: 'Sertifika ekle' })
  sertifikaEkle(
    @Param('id') id: string,
    @Body() dto: SertifikaEkleDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.servis.sertifikaEkle(id, dto, principal);
  }

  @Post(':id/zimmetler')
  @RequirePermission(IZINLER.KISI_YONET)
  @ApiOperation({
    summary: 'Zimmet ver',
    description: 'İşten ayrılmış görevlie yeni zimmet verilemez.',
  })
  zimmetEkle(
    @Param('id') id: string,
    @Body() dto: ZimmetEkleDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.servis.zimmetEkle(id, dto, principal);
  }

  @Patch('zimmetler/:zimmetId/iade')
  @RequirePermission(IZINLER.KISI_YONET)
  @ApiOperation({
    summary: 'Zimmet iade al',
    description: 'Zimmet İADE ile kapanır, silinmez — teslim geçmişi kanıttır.',
  })
  zimmetIade(
    @Param('zimmetId') zimmetId: string,
    @Body() dto: ZimmetIadeDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.servis.zimmetIade(zimmetId, dto, principal);
  }
}
