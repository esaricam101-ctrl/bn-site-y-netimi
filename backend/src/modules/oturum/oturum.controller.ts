import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IstekSiniri, Public } from '../../common/decorators';
import { OturumServisi, type GirisYaniti } from './oturum.service';
import { GirisDto, YenilemeDto } from './dto/oturum.dto';

@ApiTags('Oturum')
@Controller('oturum')
export class OturumController {
  constructor(private readonly oturum: OturumServisi) {}

  @Post('giris')
  @Public('Giriş ucudur; kimlik burada kurulur. Üç kapıdan önce gelir.')
  /*
   * ⚠️  SINIR ZORUNLUDUR. Bu uç her denemede scrypt çalıştırır (kullanıcı
   *     bulunamasa bile — zamanlama sızıntısını önlemek için) ve her çalışma
   *     ~134 MB ayırır. Sınırsız bırakıldığında tek istemci süreci düşürebilir.
   *
   *     E-posta başına 5 deneme, hedefli parola denemesini keser. IP başına 20
   *     GEVŞEKTİR ve bilinçlidir: NAT arkasındaki bir sitenin bütün sakinleri
   *     aynı adresten çıkar, sıkı bir IP sınırı meşru kullanıcıları kilitlerdi.
   */
  @IstekSiniri({ ipLimiti: 20, kimlikLimiti: 5, pencereSn: 300, kimlikAlani: 'eposta' })
  @ApiOperation({
    summary: 'Giriş yap',
    description:
      'Tek giriş ekranı. Yanıttaki varsayilanPanel, kullanıcının en geniş yetkili ' +
      'rolüne göre belirlenir (ADR v1.1 §10).\n\n' +
      '⚠️  İSTEK SINIRI: e-posta başına 5 · IP başına 20 deneme / 5 dakika. ' +
      'Aşıldığında 429 döner ve `Retry-After` başlığı bekleme süresini verir. ' +
      'Hangi sayacın dolduğu SÖYLENMEZ — söylenseydi e-postanın kayıtlı olduğu ' +
      'doğrulanırdı.',
  })
  giris(@Body() dto: GirisDto): Promise<GirisYaniti> {
    return this.oturum.giris(dto);
  }

  @Post('yenile')
  @Public('Yenileme belirteci kendi kimliğini taşır.')
  /*
   * Bu uç scrypt çalıştırmaz ama İMZA DOĞRULAR ve veritabanı okur; ayrıca
   * çalınmış bir belirteçle sınırsız erişim jetonu üretilmesinin önünde başka
   * engel yoktur (iptal listesi henüz yok — §3.F P1-10). Sınır bu yüzden
   * girişten gevşek ama VAR.
   *
   * Kimlik alanı YOK: gövdedeki `refreshToken` bir sırdır, özeti bile sayaç
   * anahtarına konmaz. IP başına sayılır.
   */
  @IstekSiniri({ ipLimiti: 60, kimlikLimiti: 60, pencereSn: 300 })
  @ApiOperation({
    summary: 'Erişim belirtecini yenile',
    description:
      'İzinler veritabanından tazelenir; eski belirteçten kopyalanmaz.\n\n' +
      '⚠️  İSTEK SINIRI: IP başına 60 istek / 5 dakika.',
  })
  yenile(@Body() dto: YenilemeDto): Promise<{ accessToken: string }> {
    return this.oturum.yenile(dto.refreshToken);
  }
}
