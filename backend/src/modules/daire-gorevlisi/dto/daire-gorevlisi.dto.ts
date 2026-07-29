/**
 * Daire görevlisi DTO'ları.
 *
 * ⚠️  SGK · DEPARTMAN · VARDİYA · ZİMMET ALANI YOKTUR ve bu bilinçlidir.
 *     Bu kişinin işvereni malik ya da kiracıdır; sayılan alanlar işverenin
 *     yükümlülüğüdür. Yönetimin kütüğünde tutulması, yönetimi hukuken
 *     işveren gibi gösterirdi. Yönetim personeli için `site-personeli`
 *     modülü kullanılır.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray, IsDateString, IsIn, IsOptional, IsString, IsUUID, Length, Matches,
  MinLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CINSIYETLER, PlakaGirdisiDto } from '../../../common/kayit/kisi-girdisi.dto';

export const DAIRE_GOREVLERI = [
  'COCUK_BAKICISI', 'HASTA_BAKICISI', 'YASLI_BAKICISI', 'EV_YARDIMCISI',
  'TEMIZLIK', 'ASCI', 'SOFOR', 'OZEL_GUVENLIK', 'OZEL_OGRETMEN', 'DIGER',
] as const;

export const GOREVLI_DURUMLARI = ['AKTIF', 'PASIF'] as const;

/** Görevliyi kim çalıştırıyor — sorumluluğun kimde olduğunu kayda geçirir. */
export const ISVEREN_TIPLERI = ['MALIK', 'KIRACI', 'SAKIN'] as const;

export class DaireGorevlisiEkleDto {
  @ApiProperty({
    description:
      'Hizmet verdiği bağımsız bölüm. ZORUNLUDUR: daire görevlisi daima tek ' +
      'bir bölüme hizmet eder; "site genelinde görevli" hâli yoktur.',
  })
  @IsUUID()
  bolumId!: string;

  @ApiProperty({
    enum: ISVEREN_TIPLERI,
    example: 'MALIK',
    description:
      'Görevliyi çalıştıran taraf. Yönetim İŞVEREN DEĞİLDİR; bu alan KVKK ' +
      'veri sorumlusunun ve SGK yükümlüsünün kim olduğunu kayda geçirir.',
  })
  @IsIn(ISVEREN_TIPLERI)
  isvereniTipi!: (typeof ISVEREN_TIPLERI)[number];

  @ApiPropertyOptional({
    description:
      'Çalıştıran kişi. İsteğe bağlı: yönetim çoğu zaman yalnızca "12 ' +
      'numaranın bakıcısı" bilgisine sahiptir.',
  })
  @IsOptional() @IsUUID()
  isverenKisiId?: string;

  // ------------------------------------------------------- kişi bilgileri

  @ApiProperty({ example: 'Elif' })
  @IsString() @Length(2, 60)
  ad!: string;

  @ApiProperty({ example: 'Demir' })
  @IsString() @Length(2, 60)
  soyad!: string;

  @ApiPropertyOptional({ example: '12345678901' })
  @IsOptional()
  @Matches(/^[0-9]{11}$/u, { message: 'TC kimlik no 11 haneli ve yalnızca rakam olmalıdır.' })
  tcKimlikNo?: string;

  @ApiPropertyOptional({ example: '05321234567' })
  @IsOptional() @IsString() @Length(7, 32)
  telefon?: string;

  @ApiPropertyOptional({ example: 'elif@ornek.test' })
  @IsOptional() @IsString() @Length(5, 180)
  eposta?: string;

  @ApiPropertyOptional({ example: '1990-06-02' })
  @IsOptional() @IsDateString({}, { message: 'Doğum tarihi YYYY-MM-DD biçiminde olmalıdır.' })
  dogumTarihi?: string;

  @ApiPropertyOptional({ enum: CINSIYETLER })
  @IsOptional() @IsIn(CINSIYETLER)
  cinsiyet?: (typeof CINSIYETLER)[number];

  @ApiPropertyOptional({ example: 'Yeşilköy Mah. 3. Sk. No 8 İstanbul' })
  @IsOptional() @IsString() @Length(5, 500)
  adres?: string;

  @ApiPropertyOptional({ example: 'Hafta içi 09:00-17:00 geliyor' })
  @IsOptional() @IsString() @Length(1, 2000)
  notlar?: string;

  @ApiPropertyOptional({
    type: [PlakaGirdisiDto],
    description:
      'Görevlinin araçları. Otopark kapasitesi malik aracıyla görevli ' +
      'aracını ayırt etmez; ikisi de aynı kütüğe yazılır.',
  })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PlakaGirdisiDto)
  plakalar?: PlakaGirdisiDto[];

  // --------------------------------------------------------- göreve özel

  @ApiProperty({ enum: DAIRE_GOREVLERI, example: 'COCUK_BAKICISI' })
  @IsIn(DAIRE_GOREVLERI)
  gorev!: (typeof DAIRE_GOREVLERI)[number];

  @ApiProperty({ example: '2026-08-01' })
  @IsDateString({}, { message: 'Çalışma başlangıcı YYYY-MM-DD biçiminde olmalıdır.' })
  calismaBaslangic!: string;

  @ApiPropertyOptional({
    example: '2027-08-01',
    description:
      'Belirli süreli çalışmada bitiş. Girildiğinde kayıt PASİF açılır — ' +
      'veritabanı kısıtı bitmiş çalışmanın AKTİF kalmasını reddeder.',
  })
  @IsOptional() @IsDateString()
  calismaBitis?: string;

  @ApiPropertyOptional({ example: 'İki çocuğa bakıyor, site girişi kartı verildi' })
  @IsOptional() @IsString() @Length(1, 2000)
  aciklama?: string;
}

/**
 * Kısmi güncelleme.
 *
 * `bolumId` ve `calismaBaslangic` DEĞİŞTİRİLEMEZ: bölüm değişirse bu artık
 * başka bir hizmet ilişkisidir ve yeni kayıt açılmalıdır; başlangıç tarihini
 * sessizce kaydırmak site giriş kaydını geçmişe dönük bozar.
 *
 * `calismaBitis` de burada değil `/ayril` ucunda verilir; durum geçişi
 * gerektirir.
 */
export class DaireGorevlisiDuzeltDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 60)
  ad?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 60)
  soyad?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(7, 32)
  telefon?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(5, 180)
  eposta?: string;

  @ApiPropertyOptional({ enum: CINSIYETLER })
  @IsOptional() @IsIn(CINSIYETLER)
  cinsiyet?: (typeof CINSIYETLER)[number];

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(5, 500)
  adres?: string;

  @ApiPropertyOptional({ enum: DAIRE_GOREVLERI })
  @IsOptional() @IsIn(DAIRE_GOREVLERI)
  gorev?: (typeof DAIRE_GOREVLERI)[number];

  @ApiPropertyOptional({ enum: ISVEREN_TIPLERI })
  @IsOptional() @IsIn(ISVEREN_TIPLERI)
  isvereniTipi?: (typeof ISVEREN_TIPLERI)[number];

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  isverenKisiId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 2000)
  aciklama?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 2000)
  notlar?: string;
}

export class DaireGorevlisiAyrilDto {
  @ApiProperty({ example: '2027-01-31' })
  @IsDateString({}, { message: 'Çalışma bitişi YYYY-MM-DD biçiminde olmalıdır.' })
  calismaBitis!: string;

  @ApiProperty({ example: 'Malik hizmet ilişkisini sonlandırdı' })
  @IsString() @MinLength(5)
  gerekce!: string;
}

export class DaireGorevlisiSilDto {
  @ApiProperty({
    example: 'Mükerrer kayıt; doğru kayıt aynı gün açıldı',
    description: 'Soft delete gerekçesi zorunludur (BFS v1 §5.2).',
  })
  @IsString() @MinLength(10, { message: 'Silme gerekçesi en az 10 karakter olmalıdır.' })
  gerekce!: string;
}
