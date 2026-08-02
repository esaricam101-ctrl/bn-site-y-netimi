import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Principal } from '@bnos/kernel';
import { IZINLER } from '@bnos/core-domain';
import { AktifPrincipal, RequirePermission } from '../../common/decorators';
import { TahakkukCommandService, type TahakkukSonucu } from './tahakkuk.command.service';
import {
  TahakkukQueryService, type BorcSatiri, type DonemOzeti,
} from './tahakkuk.query.service';
import { TahakkukCalistirDto, TahakkukMuhasebelestirDto } from './dto/tahakkuk.dto';

@ApiTags('Tahakkuk')
@ApiBearerAuth()
@Controller('tahakkuk')
export class TahakkukController {
  constructor(
    private readonly command: TahakkukCommandService,
    private readonly query: TahakkukQueryService,
  ) {}

  @Post('calistir')
  @RequirePermission(IZINLER.FINANS_TAHAKKUK)
  @ApiOperation({
    summary: 'Tahakkuk çalıştır (gideri bölümlere paylaştırıp borç yaz)',
    description:
      'Zincir: gider türü kuralı → bölümlere dağıtım → borç sorumlusu çözümü → ' +
      'malikler arası bölüşüm.\n\n' +
      'SNAPSHOT: sorumlu kişiler bu anda çözülür ve kayda yazılır. Kiracı sonra ' +
      'taşınsa bile bu dönemin borcu ona bağlı kalır.\n\n' +
      'TEK İŞLEM: bütün bölümlerin borcu tek transaction\'da yazılır. Yarım kalan ' +
      'tahakkuk, bazı dairelerin borçlandığı bir dönem bırakır.\n\n' +
      '`onizleme: true` ile borç YAZILMADAN dağıtım sonucu görülebilir.',
  })
  calistir(
    @Body() dto: TahakkukCalistirDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<TahakkukSonucu> {
    return this.command.calistir(dto, principal);
  }

  @Post('calismalar/:id/muhasebelestir')
  @RequirePermission(IZINLER.FINANS_YEVMIYE_GIRIS)
  @ApiOperation({
    summary: 'Tahakkuku deftere geçir (ADR-0017)',
    description:
      'Fiş: **borç Cari Kontrol / alacak gider türünün muhasebe hesabı**. ' +
      'Tahsilat tam tersini yazar; ikisi birlikte cari hesabı açar ve kapatır.\n\n' +
      'ÇALIŞMA BAŞINA TEK FİŞ: yevmiyede toplam durur, daire kırılımı yardımcı ' +
      'defterdedir (ADR-0010). Borç başına fiş üretilseydi 5.000 bölümlü bir ' +
      'sitede tek tahakkuk yevmiyeye 5.000 satır yazardı.\n\n' +
      'FİŞ TARİHİ tahakkuk dönemidir, vade değil.\n\n' +
      'MÜKERRER muhasebeleştirme reddedilir; düzeltme storno ile yapılır.',
  })
  muhasebelestir(
    @Param('id') id: string,
    @Body() dto: TahakkukMuhasebelestirDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<{
    readonly id: string; readonly durum: string;
    readonly fisId: string; readonly fisNo: string;
  }> {
    return this.command.muhasebelestir(id, dto, principal);
  }

  @Get('borclar')
  @RequirePermission(IZINLER.FINANS_BORCLU_DETAY)
  @ApiQuery({ name: 'bolumId', required: false })
  @ApiQuery({ name: 'donem', required: false, example: '2026-07-01' })
  @ApiQuery({ name: 'acikMi', required: false, type: Boolean })
  @ApiOperation({
    summary: 'Borçları listele',
    description:
      'Sorumluluk YENİDEN HESAPLANMAZ; borç yazıldığı andaki snapshot okunur.',
  })
  borclar(
    @AktifPrincipal() principal: Principal,
    @Query('bolumId') bolumId?: string,
    @Query('donem') donem?: string,
    @Query('acikMi') acikMi?: string,
  ): Promise<readonly BorcSatiri[]> {
    return this.query.borclar(principal, {
      ...(bolumId ? { bolumId } : {}),
      ...(donem ? { donem } : {}),
      ...(acikMi === 'true' ? { acikMi: true } : {}),
    });
  }

  @Get('donemler')
  /*
   * ⚠️  `FINANS_OZET` DEĞİL, `FINANS_BINA_OZET`.
   *
   *     Bu uç BÜTÜN bölümlerin tahakkuk toplamını döner — tek bir hanenin
   *     değil. `FINANS_OZET` ile korunduğunda KİRACI da bina geneli finansı
   *     görüyordu (canlı doğrulamada `borcSayisi: 4 · toplamTutar: 10000.00`
   *     dönmüştü). Kiracının yönetimi denetleme hakkı yoktur.
   *
   *     KAT MALİKİNİN hakkı ise KAPATILMAZ: KMK md. 38-39 uyarınca yönetimin
   *     hesabını denetlemek onun yasal hakkıdır ve bina geneli özet bu hakkın
   *     kapsamındadır. Ayrım satır kapsamıyla değil İZİNLE kurulur — çünkü
   *     burada sızan şey satır değil, TOPLAMDIR.
   */
  @RequirePermission(IZINLER.FINANS_BINA_OZET)
  @ApiOperation({ summary: 'Dönem bazlı tahakkuk ve tahsilat özeti (bina geneli)' })
  donemler(@AktifPrincipal() principal: Principal): Promise<readonly DonemOzeti[]> {
    return this.query.donemOzetleri(principal);
  }
}
