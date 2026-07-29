import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Principal } from '@bnos/kernel';
import { IZINLER } from '@bnos/core-domain';
import { AktifPrincipal, RequirePermission } from '../../common/decorators';
import { DaireGorevlisiServisi, type DaireGorevlisiSatiri } from './daire-gorevlisi.service';
import {
  DaireGorevlisiAyrilDto, DaireGorevlisiDuzeltDto, DaireGorevlisiEkleDto,
  DaireGorevlisiSilDto,
} from './dto/daire-gorevlisi.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

/**
 * Daire görevlileri — malik/kiracı/sakin tarafından ÜCRETLİ çalıştırılan,
 * bağımsız bölüme hizmet veren kişiler (çocuk bakıcısı, ev yardımcısı,
 * temizlikçi, aşçı, şoför, özel güvenlik, özel öğretmen).
 *
 * ⚠️  `/site-personeli` İLE KARIŞTIRILMAMALIDIR: orada işveren yönetimdir
 *     (site müdürü, güvenlik, temizlik kadrosu) ve SGK · departman · vardiya ·
 *     zimmet alanları vardır. Burada yoktur, çünkü bu yükümlülükler yönetimin
 *     değil malikin/kiracının üzerindedir.
 *
 * MALİK · KİRACI · SAKİN modüllerinden tümüyle AYRIDIR ve onlara dokunmaz.
 */
@ApiTags('Daire Görevlisi')
@ApiBearerAuth()
@Controller('daire-gorevlileri')
export class DaireGorevlisiController {
  constructor(private readonly servis: DaireGorevlisiServisi) {}

  @Get()
  @RequirePermission(IZINLER.KISI_GORUNTULE)
  @ApiQuery({ name: 'bolumId', required: false })
  @ApiQuery({ name: 'gorev', required: false, example: 'COCUK_BAKICISI' })
  @ApiQuery({ name: 'durum', required: false, example: 'AKTIF' })
  @ApiQuery({ name: 'arama', required: false })
  @ApiOperation({
    summary: 'Daire görevlilerini listele',
    description: 'Her satır bölüm kapı numarası, işveren ve araç plakalarıyla döner.',
  })
  listele(
    @AktifPrincipal() principal: Principal,
    @Query('bolumId') bolumId?: string,
    @Query('gorev') gorev?: string,
    @Query('durum') durum?: string,
    @Query('arama') arama?: string,
  ): Promise<readonly DaireGorevlisiSatiri[]> {
    return this.servis.listele(principal, {
      ...(bolumId ? { bolumId } : {}),
      ...(gorev ? { gorev } : {}),
      ...(durum ? { durum } : {}),
      ...(arama ? { arama } : {}),
    });
  }

  @Get(':id')
  @RequirePermission(IZINLER.KISI_GORUNTULE)
  @ApiOperation({ summary: 'Daire görevlisi kartı' })
  detay(
    @Param('id') id: string,
    @AktifPrincipal() principal: Principal,
  ): Promise<DaireGorevlisiSatiri> {
    return this.servis.detay(id, principal);
  }

  @Post()
  @RequirePermission(IZINLER.KISI_YONET)
  @ApiOperation({
    summary: 'Daire görevlisi ekle — tek ekrandan hızlı kayıt',
    description:
      'Kişi bilgileri, görev bilgileri ve araç plakaları AYNI İŞLEMDE yazılır. ' +
      'Kişi seçme zorunluluğu yoktur; görevli `kisi` kaydı KULLANMAZ çünkü hak ' +
      'sahibi değildir (borç sorumlusu olmaz, tahakkuka girmez).\n\n' +
      'Aynı TC ile AYNI BÖLÜMDE ikinci süren kayıt açılamaz. Tekillik bölüm ' +
      'başınadır: bir temizlik görevlisinin üç ayrı dairede çalışması olağandır.',
  })
  ekle(
    @Body() dto: DaireGorevlisiEkleDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu & { readonly plakaSayisi: number }> {
    return this.servis.ekle(dto, principal);
  }

  @Patch(':id')
  @RequirePermission(IZINLER.KISI_YONET)
  @ApiOperation({
    summary: 'Daire görevlisi bilgisi düzelt',
    description:
      '`bolumId` ve `calismaBaslangic` DEĞİŞTİRİLEMEZ: bölüm değişirse bu ' +
      'başka bir hizmet ilişkisidir ve yeni kayıt açılmalıdır.',
  })
  duzelt(
    @Param('id') id: string,
    @Body() dto: DaireGorevlisiDuzeltDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.servis.duzelt(id, dto, principal);
  }

  @Patch(':id/ayril')
  @RequirePermission(IZINLER.KISI_YONET)
  @ApiOperation({
    summary: 'Hizmet ilişkisini sonlandır — kayıt kapanır, silinmez',
    description:
      'Durum aynı işlemde PASIF olur. Görevlinin AÇIK ARAÇ KAYITLARI da aynı ' +
      'tarihte kapatılır; yanıtta `kapatilanAracSayisi` döner. Kapatılmasaydı ' +
      'işi bitmiş görevlinin aracı otopark sayımında yer kaplamaya devam ederdi.',
  })
  ayril(
    @Param('id') id: string,
    @Body() dto: DaireGorevlisiAyrilDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu & { readonly kapatilanAracSayisi: number }> {
    return this.servis.ayril(id, dto, principal);
  }

  @Delete(':id')
  @RequirePermission(IZINLER.KISI_YONET)
  @ApiOperation({
    summary: 'Kaydı arşivle (soft delete)',
    description:
      'Gerekçe zorunludur. Çalışmanın sona ermesi için bu uç DEĞİL `/ayril` ' +
      'kullanılır: sonlanma normal bir yaşam döngüsü olayıdır, silme ise ' +
      'hatalı kayıt içindir.',
  })
  sil(
    @Param('id') id: string,
    @Body() dto: DaireGorevlisiSilDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.servis.softSil(id, dto.gerekce, principal);
  }
}
