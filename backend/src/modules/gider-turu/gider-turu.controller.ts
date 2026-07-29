import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Principal } from '@bnos/kernel';
import { IZINLER } from '@bnos/core-domain';
import { AktifPrincipal, RequirePermission } from '../../common/decorators';
import { GiderTuruCommandService } from './gider-turu.command.service';
import { GiderTuruQueryService, type GiderTuruSatiri } from './gider-turu.query.service';
import {
  GiderTuruGuncelleDto, GiderTuruOlusturDto, GiderTuruSilDto,
} from './dto/gider-turu.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

/**
 * Gider türü kataloğu — aidat kurallarının tanımlandığı yer.
 *
 * İZİN SEÇİMİ: görüntüleme `finans.ozet`, yazma `finans.ayar` ister.
 * Bir gider türünü değiştirmek her dairenin aidatını değiştirir; bu yüzden
 * `bolum.manage` değil, finansal ayar yetkisi aranır. Yönetim kurulu üyesi
 * kuralı GÖREBİLİR ama DEĞİŞTİREMEZ — değişiklik genel kurul kararına dayanır.
 */
@ApiTags('Gider Türü')
@ApiBearerAuth()
@Controller('gider-turleri')
export class GiderTuruController {
  constructor(
    private readonly command: GiderTuruCommandService,
    private readonly query: GiderTuruQueryService,
  ) {}

  @Post()
  @RequirePermission(IZINLER.FINANS_AYAR)
  @ApiOperation({
    summary: 'Gider türü tanımla',
    description:
      'Aidat kuralları VERİDİR, koda gömülmez (634 sayılı KMK md. 20). ' +
      'KMK varsayılanı dışındaki her kural `kaynakReferansi` taşımak ZORUNDADIR: ' +
      'yönetim planı maddesi ya da genel kurul karar numarası. Referanssız bir ' +
      'override, aidata itiraz edildiğinde savunulamaz.',
  })
  olustur(
    @Body() dto: GiderTuruOlusturDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.command.olustur(dto, principal);
  }

  @Get()
  @RequirePermission(IZINLER.FINANS_OZET)
  @ApiQuery({ name: 'yalnizcaAktif', required: false, type: Boolean })
  @ApiOperation({
    summary: 'Gider türlerini listele',
    description:
      'KMK varsayılanından SAPAN kurallar `ozelKuralMi` ile işaretlenir. ' +
      'Devralınan bir binada hangi kuralların değiştirildiğini görmek, itiraz ' +
      'geldiğinde hangi belgeye bakılacağını bilmek demektir.',
  })
  listele(
    @AktifPrincipal() principal: Principal,
    @Query('yalnizcaAktif') yalnizcaAktif?: string,
  ): Promise<readonly GiderTuruSatiri[]> {
    return this.query.listele(principal, yalnizcaAktif === 'true');
  }

  @Get(':id')
  @RequirePermission(IZINLER.FINANS_OZET)
  @ApiOperation({ summary: 'Gider türü detayı' })
  detay(
    @Param('id') id: string,
    @AktifPrincipal() principal: Principal,
  ): Promise<GiderTuruSatiri> {
    return this.query.detay(id, principal);
  }

  @Patch(':id')
  @RequirePermission(IZINLER.FINANS_AYAR)
  @ApiOperation({
    summary: 'Gider türü kuralını değiştir',
    description:
      '`kod` DEĞİŞTİRİLEMEZ — geçmiş tahakkuklar bu kodla ilişkilendirilir.\n\n' +
      'Kural değişikliği GEÇMİŞE ETKİ ETMEZ: yapılmış tahakkuklar hesaplandıkları ' +
      'andaki kuralla kalır. Aksi halde kapanmış bir dönemin borçları kendiliğinden ' +
      'değişir ve tahsil edilmiş tutarlarla tutmaz.',
  })
  guncelle(
    @Param('id') id: string,
    @Body() dto: GiderTuruGuncelleDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.command.guncelle(id, dto, principal);
  }

  @Delete(':id')
  @RequirePermission(IZINLER.FINANS_AYAR)
  @ApiOperation({
    summary: 'Gider türünü arşivle',
    description:
      'Gerekçe zorunludur (BFS v1 §5.2). Kayıt silinmez, pasife alınır: geçmiş ' +
      'tahakkuklar bu türe bağlıdır ve kaydın kaybolması defterdeki kalemin ' +
      'kaynağını okunamaz kılar.',
  })
  sil(
    @Param('id') id: string,
    @Body() dto: GiderTuruSilDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.command.softSil(id, dto.gerekce, principal);
  }
}
