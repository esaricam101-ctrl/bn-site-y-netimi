import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches,
  Min, MinLength,
} from 'class-validator';

export const GOREV_TURLERI = [
  'SITE_MUDURU', 'YONETICI', 'GUVENLIK', 'TEMIZLIK', 'TEKNIK',
  'BAHCIVAN', 'VALE', 'RESEPSIYON', 'HAVUZ_GOREVLISI', 'DIGER',
] as const;

export const GOREVLI_DURUMLARI = ['AKTIF', 'PASIF'] as const;

export const VARDIYALAR = ['GUNDUZ', 'AKSAM', 'GECE', 'TAM_GUN', 'DONUSUMLU'] as const;

export class GorevliEkleDto {
  @ApiPropertyOptional({
    description:
      'Çalıştığı apartman. Site genelinde çalışan görevlide boş bırakılır.',
  })
  @IsOptional() @IsUUID()
  apartmanId?: string;

  @ApiProperty({ example: 'Ahmet' })
  @IsString() @Length(2, 60)
  ad!: string;

  @ApiProperty({ example: 'Yıldız' })
  @IsString() @Length(2, 60)
  soyad!: string;

  @ApiProperty({ enum: GOREV_TURLERI, example: 'GUVENLIK' })
  @IsIn(GOREV_TURLERI)
  gorev!: (typeof GOREV_TURLERI)[number];

  @ApiPropertyOptional({ example: 'Güvenlik Amirliği' })
  @IsOptional() @IsString() @Length(2, 80)
  departman?: string;

  @ApiPropertyOptional({ example: '05321234567' })
  @IsOptional() @IsString() @Length(7, 32)
  telefon?: string;

  @ApiPropertyOptional({ example: 'ahmet@site.test' })
  @IsOptional() @IsString() @Length(5, 180)
  eposta?: string;

  /**
   * TC kimlik no 11 hanedir ve KVKK kapsamında kişisel veridir. Biçim
   * denetimi hem burada hem veritabanı kısıtında durur: doğrudan SQL ile
   * yazılan bozuk bir kayıt bordroda sorun çıkarır.
   */
  @ApiPropertyOptional({ example: '12345678901' })
  @IsOptional()
  @Matches(/^[0-9]{11}$/u, { message: 'TC kimlik no 11 haneli ve yalnızca rakam olmalıdır.' })
  tcKimlikNo?: string;

  @ApiPropertyOptional({ example: '1234567890123', description: 'SGK sicil numarası.' })
  @IsOptional() @IsString() @Length(4, 30)
  sgkNo?: string;

  @ApiProperty({ example: '2026-01-15' })
  @IsDateString({}, { message: 'İşe giriş tarihi YYYY-MM-DD biçiminde olmalıdır.' })
  iseGirisTarihi!: string;

  @ApiPropertyOptional({ enum: VARDIYALAR, example: 'GUNDUZ' })
  @IsOptional() @IsIn(VARDIYALAR)
  vardiya?: (typeof VARDIYALAR)[number];

  @ApiPropertyOptional({ example: 'Gece vardiyasına da girebilir' })
  @IsOptional() @IsString() @Length(1, 2000)
  notlar?: string;
}

/**
 * Kısmi güncelleme.
 *
 * `iseGirisTarihi` DEĞİŞTİRİLEMEZ: kıdem ve SGK bildirimleri bu tarihe
 * dayanır. Yanlış girilmişse kayıt kapatılıp yenisi açılır — düzeltme,
 * geçmiş bordroyu sessizce değiştirmemelidir.
 *
 * `istenAyrilisTarihi` de burada DEĞİŞTİRİLEMEZ; ayrılış ayrı bir uçtur
 * (`/ayril`) çünkü durum geçişi ve zimmet denetimi gerektirir.
 */
export class GorevliDuzeltDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID()
  apartmanId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 60)
  ad?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 60)
  soyad?: string;

  @ApiPropertyOptional({ enum: GOREV_TURLERI })
  @IsOptional() @IsIn(GOREV_TURLERI)
  gorev?: (typeof GOREV_TURLERI)[number];

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 80)
  departman?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(7, 32)
  telefon?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(5, 180)
  eposta?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(4, 30)
  sgkNo?: string;

  @ApiPropertyOptional({ enum: VARDIYALAR })
  @IsOptional() @IsIn(VARDIYALAR)
  vardiya?: (typeof VARDIYALAR)[number];

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 2000)
  notlar?: string;
}

export class GorevliAyrilDto {
  @ApiProperty({ example: '2026-08-31' })
  @IsDateString({}, { message: 'Ayrılış tarihi YYYY-MM-DD biçiminde olmalıdır.' })
  istenAyrilisTarihi!: string;

  @ApiProperty({ example: 'İstifa dilekçesi 2026/14' })
  @IsString() @MinLength(5)
  gerekce!: string;
}

export class GorevliSilDto {
  @ApiProperty({
    example: 'Mükerrer kayıt; doğru kayıt aynı gün açıldı',
    description: 'Soft delete gerekçesi zorunludur (BFS v1 §5.2).',
  })
  @IsString() @MinLength(10, { message: 'Silme gerekçesi en az 10 karakter olmalıdır.' })
  gerekce!: string;
}

export class SertifikaEkleDto {
  @ApiProperty({ example: 'Özel Güvenlik Kimlik Kartı' })
  @IsString() @Length(2, 120)
  ad!: string;

  @ApiPropertyOptional({ example: 'Emniyet Genel Müdürlüğü' })
  @IsOptional() @IsString() @Length(2, 120)
  kurum?: string;

  @ApiPropertyOptional({ example: 'OG-2026-4471' })
  @IsOptional() @IsString() @Length(1, 60)
  belgeNo?: string;

  @ApiProperty({ example: '2026-02-01' })
  @IsDateString()
  verilisTarihi!: string;

  @ApiPropertyOptional({
    example: '2031-02-01',
    description: 'Süresi dolmuş sertifikayla çalıştırmak idari yaptırım sebebidir.',
  })
  @IsOptional() @IsDateString()
  gecerlilikBitisi?: string;
}

export class ZimmetEkleDto {
  @ApiProperty({ example: 'Telsiz' })
  @IsString() @Length(2, 120)
  ad!: string;

  @ApiPropertyOptional({ example: 'TLS-0042' })
  @IsOptional() @IsString() @Length(1, 60)
  seriNo?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional() @IsInt() @Min(1)
  adet?: number;

  @ApiProperty({ example: '2026-02-01' })
  @IsDateString()
  zimmetTarihi!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 500)
  notlar?: string;
}

export class ZimmetIadeDto {
  @ApiProperty({ example: '2026-08-31' })
  @IsDateString()
  iadeTarihi!: string;

  @ApiPropertyOptional({ example: 'Hasarsız teslim alındı' })
  @IsOptional() @IsString() @Length(1, 500)
  notlar?: string;
}
