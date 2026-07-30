import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';
import type { Principal } from '@bnos/kernel';
// `RequirePermission` BİLEREK KULLANILMIYOR — gerekçe sınıf yorumunda.
import { AktifPrincipal } from '../../common/decorators';
import { GeriAlmaServisi, type IslemSatiri } from './geri-alma.service';

export class GeriAlDto {
  @ApiPropertyOptional({
    example: 'Yanlış daireye tahsilat girildi',
    description:
      'Geri alma gerekçesi. Denetim kaydına ve geri alma geçmişine yazılır.',
  })
  @IsOptional() @IsString() @MinLength(5, { message: 'Gerekçe en az 5 karakter olmalıdır.' })
  gerekce?: string;
}

export class OnayDto {
  @ApiProperty({
    example: true,
    description:
      'ONAY ZORUNLUDUR. İstemci `islemlerim` yanıtındaki `onayMetni`ni ' +
      'kullanıcıya göstermeden bu ucu çağırmamalıdır.',
  })
  onaylandi!: boolean;
}

/**
 * GENEL GERİ AL — "Son İşlemi Geri Al".
 *
 * ⚠️  YETKİ SINIRI **SAHİPLİKTİR**, ayrı bir modül izni DEĞİLDİR.
 *
 *     İlk yazımda uçlar `AUDIT_GORUNTULE` iznine bağlanmıştı ve canlı testte
 *     **403** döndü: o izin yalnızca DENETÇİ rolündedir. Yani kaydı GİREN
 *     kullanıcı kendi işlemini geri alamıyordu — özelliğin bütün amacı bu
 *     olmasına rağmen.
 *
 *     Doğru sınır şudur: geri alma, kullanıcının ZATEN YAPMAYA YETKİLİ OLDUĞU
 *     bir işlemi geri çevirir. Orijinal işlem kendi modül iznini (Kapı 3)
 *     geçerek yapılmıştır. Ayrı bir izin istemek "yapabilir ama geri alamaz"
 *     gibi tutarsız bir durum üretir; başkasının izniyle korunmak da gerekmez
 *     çünkü servis işlemin KULLANICININ KENDİSİNE ait olduğunu doğrular ve
 *     başkasının kaydı listeye HİÇ girmez.
 *
 *     Kapı 1 (kimlik) ve Kapı 2 (tenant) yine çalışır; yalnızca Kapı 3'te
 *     modül izni aranmaz. Yeni izin de TANIMLANMADI — yetki matrisi
 *     değiştirilmedi.
 *
 * ⚠️  TEK İSTİSNA: `gecmis?tumu=true` başka kullanıcıların geri almalarını
 *     gösterir; bu bir DENETİM görünümüdür ve `AUDIT_GORUNTULE` ister.
 *
 * ⚠️  FİNANSAL KAYIT SİLİNMEZ — ters kayıt üretilir (BFS v1 §5.1).
 */
@ApiTags('Geri Al')
@ApiBearerAuth()
@Controller('geri-alma')
export class GeriAlmaController {
  constructor(private readonly servis: GeriAlmaServisi) {}

  @Get('islemlerim')
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiOperation({
    summary: 'Son işlemlerim — geri alınabilirlik durumuyla',
    description:
      'YALNIZCA KULLANICININ KENDİ işlemleri döner. Başkasının işlemi ' +
      '"geri alınamaz" diye işaretlenip listelenseydi, kullanıcı başkalarının ' +
      'ne yaptığını görürdü — bu bir yetki sızıntısıdır.\n\n' +
      'Her satır şunları taşır:\n' +
      '· `geriAlinabilirMi` — geri alınabilir mi\n' +
      '· `yontem` — TERS_KAYIT · GERI_YUKLE · ARSIVLE · ALAN_GERI_AL\n' +
      '· `engelGerekcesi` — alınamıyorsa NEDEN (gerekçesiz ret, kullanıcıyı ' +
      'aynı işlemi tekrar denemeye iter)\n' +
      '· `onayMetni` — geri alma öncesi gösterilecek onay metni\n\n' +
      'Okuma ve oturum kayıtları (OKU · DISA_AKTAR · GIRIS · CIKIS) listeye ' +
      'HİÇ girmez: geri alınacak bir değişiklik yoktur.',
  })
  islemlerim(
    @AktifPrincipal() principal: Principal,
    @Query('limit') limit?: string,
  ): Promise<readonly IslemSatiri[]> {
    const n = limit === undefined ? 50 : Number.parseInt(limit, 10);
    return this.servis.islemlerim(
      principal,
      Number.isFinite(n) && n > 0 && n <= 200 ? n : 50,
    );
  }

  @Post(':auditKaydiId/geri-al')
  @ApiOperation({
    summary: 'İşlemi geri al (onay gerektirir)',
    description:
      'Geri alma yolu varlığın SİLME SINIFINA göre değişir:\n\n' +
      '· **FİNANSAL** (Tahsilat · Fiş · Banka Hareketi · Borç) → **TERS_KAYIT.** ' +
      'Kayıt SİLİNMEZ; makbuz iptal edilir ya da ters fiş üretilir ve iki kayıt ' +
      'da defterde kalır.\n' +
      '· **BELGE** → yükleme geri alınırsa ARŞİVLENİR; dosya silinmez, sürüm ' +
      'geçmişi korunur.\n' +
      '· **ANA_VERİ** → oluşturma geri alınırsa ARŞİVLENİR (soft delete); ' +
      'arşivleme geri alınırsa GERİ YÜKLENİR; güncelleme geri alınırsa ' +
      'yalnızca DEĞİŞEN alanlar eski değerine döner.\n\n' +
      'Geri alınamayan durumlar ve gerekçeleri:\n' +
      '· Başka kullanıcının işlemi\n' +
      '· Zaten geri alınmış (aynı işlem iki kez geri alınamaz — alınabilseydi ' +
      'arada yapılan başka değişiklikler sessizce silinirdi)\n' +
      '· Kayıt sonradan tekrar değiştirilmiş (eski bir güncellemeyi geri almak, ' +
      'sonraki değişiklikleri de sessizce siler)\n' +
      '· Anonimleştirme (KVKK — veri geri döndürülemez)\n' +
      '· Muhasebeleşmiş finansal kayıt (önce fiş storno)\n' +
      '· Kapalı dönem\n' +
      '· Geri alma kuralı tanımlı olmayan varlık (bilinmeyen varlık REDDEDİLİR; ' +
      '"muhtemelen ana veridir" varsayımıyla devam edilseydi finansal bir kayıt ' +
      'silinebilirdi)',
  })
  geriAl(
    @Param('auditKaydiId') auditKaydiId: string,
    @Body() dto: GeriAlDto,
    @AktifPrincipal() principal: Principal,
  ): ReturnType<GeriAlmaServisi['geriAl']> {
    return this.servis.geriAl(auditKaydiId, dto.gerekce, principal);
  }

  @Get('gecmis')
  @ApiOperation({
    summary: 'Geri alma geçmişim',
    description:
      'Kullanıcının yaptığı geri alma işlemleri — hangi varlık, hangi yöntem, ' +
      'ne zaman, hangi gerekçeyle. Kayıtlar DEĞİŞTİRİLEMEZ: `geri_alma` ' +
      'tablosuna yalnızca SELECT ve INSERT yetkisi verilmiştir.\n\n' +
      '⚠️  TENANT GENELİ görünüm BURADA YOKTUR ve bilinçlidir: başkalarının ' +
      'işlemlerini görmek bir DENETİM yetkisidir ve `/audit` ucunda zaten ' +
      'vardır. İkinci bir kapı açmak, aynı yetkinin iki yerden denetlenmesi ' +
      'demektir; biri gevşetildiğinde öteki fark edilmez.',
  })
  gecmis(
    @AktifPrincipal() principal: Principal,
  ): ReturnType<GeriAlmaServisi['gecmis']> {
    return this.servis.gecmis(principal);
  }
}
