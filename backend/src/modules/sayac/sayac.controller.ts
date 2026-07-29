import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Principal } from '@bnos/kernel';
import { IZINLER } from '@bnos/core-domain';
import { AktifPrincipal, RequirePermission } from '../../common/decorators';
import {
  SayacServisi, type BolumTuketimi, type OkumaSatiri, type SayacSatiri,
} from './sayac.service';
import { OkumaEkleDto, SayacSokDto, SayacTakDto } from './dto/sayac.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

@ApiTags('Sayaç')
@ApiBearerAuth()
@Controller('sayaclar')
export class SayacController {
  constructor(private readonly servis: SayacServisi) {}

  @Get()
  @RequirePermission(IZINLER.BOLUM_GORUNTULE)
  @ApiQuery({ name: 'bolumId', required: false })
  @ApiQuery({ name: 'tur', required: false })
  @ApiQuery({ name: 'yalnizcaAktif', required: false, type: Boolean })
  @ApiOperation({
    summary: 'Sayaçları listele',
    description:
      'Sökülmüş sayaçlar da döner ve `aktifMi` ile işaretlenir: geçmiş dönemin ' +
      'TUKETIM dağıtımı bu kayıtlara dayanır.',
  })
  listele(
    @AktifPrincipal() principal: Principal,
    @Query('bolumId') bolumId?: string,
    @Query('tur') tur?: string,
    @Query('yalnizcaAktif') yalnizcaAktif?: string,
  ): Promise<readonly SayacSatiri[]> {
    return this.servis.listele(principal, {
      ...(bolumId ? { bolumId } : {}),
      ...(tur ? { tur } : {}),
      ...(yalnizcaAktif === 'true' ? { yalnizcaAktif: true } : {}),
    });
  }

  @Post()
  @RequirePermission(IZINLER.BOLUM_YONET)
  @ApiOperation({
    summary: 'Sayaç tak',
    description:
      '`oncekiSayacId` verilirse eski sayaç AYNI İŞLEMDE sökülür ve değişim ' +
      'zinciri kurulur. İki ayrı çağrıda yapılsaydı arada iki sayaç birden ' +
      'aktif görünür ve tüketim iki kez sayılırdı.\n\n' +
      'Değişimde tür ve bölüm aynı olmak zorundadır: farklı türdeki sayaçların ' +
      'tüketimi toplanmaz.',
  })
  tak(
    @Body() dto: SayacTakDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.servis.tak(dto, principal);
  }

  @Patch(':id/sok')
  @RequirePermission(IZINLER.BOLUM_YONET)
  @ApiOperation({
    summary: 'Sayacı sök',
    description:
      'Kayıt SİLİNMEZ. Sökülme tarihinden sonraya okuma varsa reddedilir — ' +
      'sayaç sökülmüşken okunmuş görünürse tüketim yanlış döneme yazılır.',
  })
  sok(
    @Param('id') id: string,
    @Body() dto: SayacSokDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.servis.sok(id, dto, principal);
  }

  @Get(':id/okumalar')
  @RequirePermission(IZINLER.BOLUM_GORUNTULE)
  @ApiOperation({ summary: 'Sayacın okuma geçmişi ve tüketimleri' })
  okumalar(
    @Param('id') id: string,
    @AktifPrincipal() principal: Principal,
  ): Promise<readonly OkumaSatiri[]> {
    return this.servis.okumalar(id, principal);
  }

  @Post(':id/okumalar')
  @RequirePermission(IZINLER.BOLUM_YONET)
  @ApiOperation({
    summary: 'Okuma ekle (tüketim hesaplanır ve SAKLANIR)',
    description:
      'SAYAÇ GERİYE GİTMEZ: küçülen okuma reddedilir. Gösterge başa döndüyse ' +
      '`devirMi: true` ile AÇIKÇA bildirilmelidir — tahmin edilirse veri girişi ' +
      'hatası devir sanılır ve gerçekte olmayan bir tüketim yazılır.\n\n' +
      'Tüketim hesaplanıp KAYDA YAZILIR (snapshot). Sorgu anında yeniden ' +
      'hesaplansaydı, bir okuma sonradan düzeltildiğinde geçmiş dönemlerin ' +
      'dağıtımı kendiliğinden değişir ve tahsil edilmiş aidatla tutmazdı.\n\n' +
      'Okumalar TARİH SIRASIYLA eklenir; araya geçmiş tarihli okuma girmek ' +
      'sonraki tüketimleri yanlış bırakacağı için reddedilir.',
  })
  okumaEkle(
    @Param('id') id: string,
    @Body() dto: OkumaEkleDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu & { tuketim: string; tuketimMetni: string }> {
    return this.servis.okumaEkle(id, dto, principal);
  }

  @Get('tuketim/donem')
  @RequirePermission(IZINLER.FINANS_OZET)
  @ApiQuery({ name: 'tur', required: true, example: 'SU' })
  @ApiQuery({ name: 'baslangic', required: true, example: '2026-07-01' })
  @ApiQuery({ name: 'bitis', required: true, example: '2026-07-31' })
  @ApiOperation({
    summary: 'Dönem tüketimi — tahakkukun TUKETIM kuralı için bölüm ağırlıkları',
    description:
      'Sayaç değişimi BURADA çözülür: bir bölümde dönem içinde birden çok sayaç ' +
      'varsa tüketim hepsinin toplamıdır (`sayacSayisi > 1`).\n\n' +
      'Okuması olmayan bölüm GİZLENMEZ, `okumaYokMu` ile işaretlenir. Sessizce ' +
      'sıfır yazmak o daireyi ısıtma giderinden tümüyle muaf tutar ve farkı ' +
      'diğer dairelere yükler.',
  })
  donemTuketimi(
    @AktifPrincipal() principal: Principal,
    @Query('tur') tur: string,
    @Query('baslangic') baslangic: string,
    @Query('bitis') bitis: string,
  ): Promise<readonly BolumTuketimi[]> {
    return this.servis.donemTuketimi(principal, tur, baslangic, bitis);
  }

  @Get(':id/degisim-tuketimi')
  @RequirePermission(IZINLER.FINANS_OZET)
  @ApiOperation({
    summary: 'Değişim dönemi tüketimi — iki parçanın toplamı',
    description:
      'Eski sayacın son okumasına kadarki tüketim + yeni sayacın ilk değerinden ' +
      'itibaren olan tüketim. "Bu ay neden iki kalem var?" sorusunun cevabıdır.',
  })
  degisimTuketimi(
    @Param('id') id: string,
    @AktifPrincipal() principal: Principal,
  ): Promise<{
    readonly eskiSeriNo: string;
    readonly yeniSeriNo: string;
    readonly toplam: string;
    readonly toplamMetni: string;
  }> {
    return this.servis.degisimTuketimi(id, principal);
  }
}
