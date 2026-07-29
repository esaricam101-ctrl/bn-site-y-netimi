import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Principal } from '@bnos/kernel';
import { IZINLER } from '@bnos/core-domain';
import { AktifPrincipal, RequirePermission } from '../../common/decorators';
import { KonutCalisaniServisi, type CalisanSatiri } from './konut-calisani.service';
import {
  CalisanAyrilDto, CalisanDuzeltDto, CalisanEkleDto, CalisanSilDto,
  SertifikaEkleDto, ZimmetEkleDto, ZimmetIadeDto,
} from './dto/konut-calisani.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

/**
 * Konut çalışanları — sitede/apartmanda çalışan personel.
 *
 * MALİK · KİRACI · SAKİN modüllerinden tümüyle AYRIDIR ve onlara dokunmaz.
 * Personel bir istihdam kaydıdır; malik/kiracı/sakin ise bağımsız bölüme
 * bağlı hak sahipliği kayıtlarıdır.
 */
@ApiTags('Konut Çalışanı')
@ApiBearerAuth()
@Controller('konut-calisanlari')
export class KonutCalisaniController {
  constructor(private readonly servis: KonutCalisaniServisi) {}

  @Get()
  @RequirePermission(IZINLER.KISI_GORUNTULE)
  @ApiQuery({ name: 'gorev', required: false })
  @ApiQuery({ name: 'durum', required: false, example: 'AKTIF' })
  @ApiQuery({ name: 'apartmanId', required: false })
  @ApiQuery({ name: 'arama', required: false })
  @ApiOperation({
    summary: 'Personeli listele',
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
  ): Promise<readonly CalisanSatiri[]> {
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
    summary: 'Sertifikası süresi dolmuş AKTİF personel',
    description:
      'Süresi geçmiş güvenlik sertifikasıyla çalıştırmak idari yaptırım ' +
      'sebebidir; bu ancak takip edilirse görülür.',
  })
  sertifikasiDolanlar(
    @AktifPrincipal() principal: Principal,
  ): Promise<readonly CalisanSatiri[]> {
    return this.servis.sertifikasiDolanlar(principal);
  }

  @Get(':id')
  @RequirePermission(IZINLER.KISI_GORUNTULE)
  @ApiOperation({ summary: 'Personel kartı' })
  detay(
    @Param('id') id: string,
    @AktifPrincipal() principal: Principal,
  ): Promise<CalisanSatiri> {
    return this.servis.detay(id, principal);
  }

  @Post()
  @RequirePermission(IZINLER.KISI_YONET)
  @ApiOperation({
    summary: 'Personel ekle',
    description:
      'Aynı TC kimlik numarasıyla AKTİF ikinci kayıt açılamaz — mükerrer ' +
      'personel bordroyu ikiye katlar. Ayrılmış kayıt engellemez: aynı kişi ' +
      'tekrar işe alınabilir.',
  })
  ekle(
    @Body() dto: CalisanEkleDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.servis.ekle(dto, principal);
  }

  @Patch(':id')
  @RequirePermission(IZINLER.KISI_YONET)
  @ApiOperation({
    summary: 'Personel bilgisi düzelt',
    description:
      '`iseGirisTarihi` DEĞİŞTİRİLEMEZ: kıdem ve SGK bildirimleri bu tarihe ' +
      'dayanır. Yanlış girilmişse kayıt kapatılıp yenisi açılır.',
  })
  duzelt(
    @Param('id') id: string,
    @Body() dto: CalisanDuzeltDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.servis.duzelt(id, dto, principal);
  }

  @Patch(':id/ayril')
  @RequirePermission(IZINLER.KISI_YONET)
  @ApiOperation({
    summary: 'İşten ayrılış — kayıt kapanır, silinmez',
    description:
      'Durum aynı işlemde PASIF olur; ayrılmış personelin AKTİF kalması ' +
      'veritabanı kısıtıyla reddedilir.\n\n' +
      'AÇIK ZİMMET ENGELLEMEZ, UYARIR: yanıtta `acikZimmetSayisi` döner. ' +
      'Engellemek, kaydı hiç kapatmamaya ve aktif personel listesinin ' +
      'bozulmasına yol açardı.',
  })
  ayril(
    @Param('id') id: string,
    @Body() dto: CalisanAyrilDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu & { readonly acikZimmetSayisi: number }> {
    return this.servis.ayril(id, dto, principal);
  }

  @Delete(':id')
  @RequirePermission(IZINLER.KISI_YONET)
  @ApiOperation({
    summary: 'Personel kaydını arşivle (soft delete)',
    description:
      'Gerekçe zorunludur. İşten ayrılış için bu uç DEĞİL `/ayril` kullanılır: ' +
      'ayrılış normal bir yaşam döngüsü olayıdır, silme ise hatalı kayıt içindir.',
  })
  sil(
    @Param('id') id: string,
    @Body() dto: CalisanSilDto,
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
    description: 'İşten ayrılmış personele yeni zimmet verilemez.',
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
