import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Principal } from '@bnos/kernel';
import { IZINLER } from '@bnos/core-domain';
import { AktifPrincipal, RequirePermission } from '../../common/decorators';
import { PortfoyServisi, type PortfoyOzeti } from './portfoy.service';
import { DevirEkleDto, DevirSonlandirDto } from './dto/portfoy.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

/**
 * Portföy Yönetim Merkezi — yönetim firmasının kontrol merkezi (ADR-0009).
 *
 * Yönetim firması sisteme girdiğinde doğrudan bir site/apartman paneline
 * yönlendirilmez; ilk açılan ekran burasıdır. Proje seçildikten sonra yalnızca
 * o projenin verisi görünür — `/portfoy/projeler/:id/gir` proje kapsamlı bir
 * jeton üretir ve Kapı 2 devri doğrular.
 *
 * ⚠️  ÇAPRAZ-TENANT SORGU YOKTUR. Özet proje başına ayrı sorgu + uygulama
 *     katmanında toplamadır (ADR-0002'nin kabul ettiği bedel).
 */
@ApiTags('Portföy')
@ApiBearerAuth()
@Controller('portfoy')
export class PortfoyController {
  constructor(private readonly servis: PortfoyServisi) {}

  @Get('ozet')
  @RequirePermission(IZINLER.TENANT_GORUNTULE)
  @ApiOperation({
    summary: 'Kontrol merkezi özeti',
    description:
      'Yönetilen site/apartman sayısı, toplam bağımsız bölüm, malik, kiracı, ' +
      'sakin, personel, içerideki misafir, tahsilat durumu, kritik uyarılar ve ' +
      'veriden türetilen öneriler.\n\n' +
      '`acikIsEmri` ve `bekleyenTalep` alanları **-1** döner: bu modüller henüz ' +
      'yok ve uydurma sayı üretilmez.\n\n' +
      'Özeti okunamayan proje satır olarak YİNE DÖNER (`ozetHatasi` dolu): bir ' +
      'projenin arızası öteki projelerin görünmesini engellememelidir.',
  })
  ozet(@AktifPrincipal() principal: Principal): Promise<PortfoyOzeti> {
    return this.servis.ozet(principal);
  }

  @Post('projeler/:projeTenantId/gir')
  @RequirePermission(IZINLER.TENANT_GORUNTULE)
  @ApiOperation({
    summary: 'Projeye gir — proje kapsamlı jeton üretir',
    description:
      'Jeton `tid = proje` ve `dvr = firma` taşır. Firma kullanıcısının projede ' +
      'AYRI bir `kullanici` kaydı YOKTUR; erişim aktif devir kaydından gelir ve ' +
      'Kapı 2 her istekte devrin geçerliliğini doğrular.\n\n' +
      'İzinler firmadaki rolden gelir. İşlem denetime yazılır: projede yapılan ' +
      'her şeyin hangi firma adına yapıldığı sorulabilir olmalıdır.',
  })
  gir(
    @Param('projeTenantId') projeTenantId: string,
    @AktifPrincipal() principal: Principal,
  ): Promise<{
    readonly accessToken: string;
    readonly projeTenantId: string;
    readonly projeAdi: string;
    readonly devirDayanagi: string;
  }> {
    return this.servis.projeyeGir(projeTenantId, principal);
  }

  @Post('devirler')
  @RequirePermission(IZINLER.TENANT_KURULUM)
  @ApiOperation({
    summary: 'Yönetim devri ekle',
    description:
      'Bir projenin yönetimini firmaya bağlar. AYNI PROJE AYNI ANDA İKİ FİRMAYA ' +
      'DEVREDİLEMEZ — kısmî unique index bunu veritabanında da zorlar; aksi ' +
      'hâlde "bu daireye kim tahakkuk yaptı" sorusunun tek cevabı kalmazdı.',
  })
  devirEkle(
    @Body() dto: DevirEkleDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.servis.devirEkle(dto, principal);
  }

  @Patch('devirler/:id/sonlandir')
  @RequirePermission(IZINLER.TENANT_KURULUM)
  @ApiOperation({
    summary: 'Devri sona erdir — kayıt silinmez',
    description:
      'Hangi firmanın hangi tarihte yetkili olduğu, geçmişe dönük her tahakkukun ' +
      'dayanağıdır; kayıt silinmez, durumu değişir. Gerekçe zorunludur.',
  })
  devirSonlandir(
    @Param('id') id: string,
    @Body() dto: DevirSonlandirDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.servis.devirSonlandir(id, dto, principal);
  }
}
