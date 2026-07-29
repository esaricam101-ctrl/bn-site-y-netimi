import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Principal } from '@bnos/kernel';
import { IZINLER } from '@bnos/core-domain';
import { AktifPrincipal, RequirePermission } from '../../common/decorators';
import {
  BelgeServisi, type BelgeSatiri, type PolitikaSatiri,
} from './belge.service';
import {
  BelgeKaydetDto, BelgeSilDto, PolitikaGuncelleDto, YeniSurumDto, YuklemeIzniDto,
} from './dto/belge.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

@ApiTags('Belge')
@ApiBearerAuth()
@Controller('belgeler')
export class BelgeController {
  constructor(private readonly servis: BelgeServisi) {}

  @Post('yukleme-izni')
  @RequirePermission(IZINLER.BELGE_YUKLE)
  @ApiOperation({
    summary: 'Yükleme izni al (önimzalı URL)',
    description:
      'DOSYA API\'DEN GEÇMEZ; doğrudan nesne deposuna yüklenir. 50 MB\'lık bir ' +
      'yönetim planını Node süreci üzerinden akıtmak eşzamanlı yüklemelerde ' +
      'olay döngüsünü tıkar.\n\n' +
      'Bu adımda veritabanına HİÇBİR ŞEY yazılmaz: kullanıcı vazgeçerse ortada ' +
      'dosyasız kayıt kalmaz. Dönen `dosyaAnahtari` kayıt adımında geri gönderilir.',
  })
  yuklemeIzni(
    @Body() dto: YuklemeIzniDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<{ readonly dosyaAnahtari: string; readonly url: string; readonly omurSaniye: number }> {
    return this.servis.yuklemeIzni(dto, principal);
  }

  @Post()
  @RequirePermission(IZINLER.BELGE_YUKLE)
  @ApiOperation({
    summary: 'Belge kaydet (yükleme sonrası)',
    description:
      'Nesnenin GERÇEKTEN yüklendiği kayıttan ÖNCE doğrulanır. Doğrulanmasaydı, ' +
      'önimzalı URL alıp dosyayı yüklemeyen bir istemci "belge var" diyen ama ' +
      'indirilemeyen bir satır bırakırdı.\n\n' +
      'Anahtar bu yerleşkenin önekini taşımak zorundadır: başka bir tenant\'ın ' +
      'anahtarı gönderilerek onun dosyasına kayıt açılamaz.',
  })
  kaydet(
    @Body() dto: BelgeKaydetDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.servis.kaydet(dto, principal);
  }

  @Get()
  @RequirePermission(IZINLER.BELGE_GORUNTULE)
  @ApiQuery({ name: 'kapsam', required: false })
  @ApiQuery({ name: 'hedefId', required: false })
  @ApiQuery({ name: 'tip', required: false })
  @ApiQuery({ name: 'arsiviDahilEt', required: false, type: Boolean })
  @ApiOperation({
    summary: 'Belgeleri listele',
    description:
      'Varsayılan olarak yalnızca GÜNCEL sürümler döner; arşiv `arsiviDahilEt` ' +
      'ile açılır. Her satır `silinebilirMi` ve nedenini taşır.',
  })
  listele(
    @AktifPrincipal() principal: Principal,
    @Query('kapsam') kapsam?: string,
    @Query('hedefId') hedefId?: string,
    @Query('tip') tip?: string,
    @Query('arsiviDahilEt') arsiviDahilEt?: string,
  ): Promise<readonly BelgeSatiri[]> {
    return this.servis.listele(principal, {
      ...(kapsam ? { kapsam } : {}),
      ...(hedefId ? { hedefId } : {}),
      ...(tip ? { tip } : {}),
      ...(arsiviDahilEt === 'true' ? { arsiviDahilEt: true } : {}),
    });
  }

  @Get('gecerliligi-dolanlar')
  @RequirePermission(IZINLER.BELGE_GORUNTULE)
  @ApiOperation({
    summary: 'Geçerliliği dolmuş belgeler',
    description:
      'Poliçe ve ruhsat takibi. Süresi dolmuş bir sigorta poliçesi, hasar ' +
      'anında ortaya çıkarsa geç kalınmış olur.',
  })
  gecerliligiDolanlar(
    @AktifPrincipal() principal: Principal,
  ): Promise<readonly BelgeSatiri[]> {
    return this.servis.gecerliligiDolanlar(principal);
  }

  @Get('politikalar')
  @RequirePermission(IZINLER.BELGE_GORUNTULE)
  @ApiOperation({
    summary: 'Belge saklama politikaları',
    description: 'Saklama süresi VERİDİR, koda gömülmez; mevzuat ve yönetim kararı değişir.',
  })
  politikalar(@AktifPrincipal() principal: Principal): Promise<readonly PolitikaSatiri[]> {
    return this.servis.politikalariListele(principal);
  }

  @Patch('politikalar/:tip')
  @RequirePermission(IZINLER.BELGE_YUKLE)
  @ApiOperation({
    summary: 'Saklama süresini değiştir',
    description:
      '`finansalMi` DEĞİŞTİRİLEMEZ: finansal sınıf bir mevzuat sonucudur ' +
      '(VUK md. 253), yönetim tercihi değil. Kapatılabilseydi bir yönetici ' +
      'faturaları silinebilir hale getirip mali denetim izini yok edebilirdi.',
  })
  politikaGuncelle(
    @Param('tip') tip: string,
    @Body() dto: PolitikaGuncelleDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.servis.politikaGuncelle(tip, dto, principal);
  }

  @Get(':id/indirme-izni')
  @RequirePermission(IZINLER.BELGE_GORUNTULE)
  @ApiOperation({
    summary: 'İndirme izni al (önimzalı URL)',
    description:
      'URL kısa ömürlüdür (5 dk): sızan bir bağlantı süresiz erişim vermemeli. ' +
      'İndirme `attachment` olarak zorlanır — HTML/SVG bir belge tarayıcıda ' +
      'açıldığında depo alan adında betik çalıştırabilir.',
  })
  indirmeIzni(
    @Param('id') id: string,
    @AktifPrincipal() principal: Principal,
  ): Promise<{ readonly url: string; readonly omurSaniye: number }> {
    return this.servis.indirmeIzni(id, principal);
  }

  @Get(':id/surumler')
  @RequirePermission(IZINLER.BELGE_GORUNTULE)
  @ApiOperation({
    summary: 'Sürüm geçmişi (en yeniden en eskiye)',
    description:
      'BELGE SİLİNMEZ, VERSİYONLANIR. "Hangi yönetim planına göre karar verildi?" ' +
      'sorusunun cevabı eski sürümdedir.',
  })
  surumler(
    @Param('id') id: string,
    @AktifPrincipal() principal: Principal,
  ): Promise<readonly BelgeSatiri[]> {
    return this.servis.surumGecmisi(id, principal);
  }

  @Post(':id/yeni-surum')
  @RequirePermission(IZINLER.BELGE_YUKLE)
  @ApiOperation({
    summary: 'Yeni sürüm yayınla',
    description:
      'Eski sürüm ARŞİVLENİR, silinmez. Zincirin ucu olmayan bir sürüme yeni ' +
      'sürüm bağlanamaz: aynı numarada iki dal oluşur ve "güncel sürüm hangisi?" ' +
      'sorusu cevapsız kalır.',
  })
  yeniSurum(
    @Param('id') id: string,
    @Body() dto: YeniSurumDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.servis.yeniSurum(id, dto, principal);
  }

  @Delete(':id')
  @RequirePermission(IZINLER.BELGE_YUKLE)
  @ApiOperation({
    summary: 'Belgeyi sil (yalnızca politika izin veriyorsa)',
    description:
      'FİNANSAL belgeler ASLA silinmez. Diğerleri yalnızca ARŞİVDEYSE ve saklama ' +
      'süresi dolduysa silinebilir. Silme soft delete\'tir; nesne deposundaki ' +
      'dosya da bırakılır — hard delete geri alınamaz ve yanlış bir karar kanıtı ' +
      'yok eder.',
  })
  sil(
    @Param('id') id: string,
    @Body() dto: BelgeSilDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.servis.sil(id, dto.gerekce, principal);
  }
}
