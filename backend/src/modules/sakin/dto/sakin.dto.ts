import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

export const YAKINLIK_DERECELERI = [
  'KENDISI', 'ES', 'COCUK', 'ANNE_BABA', 'KARDES', 'AKRABA',
  'MISAFIR', 'CALISAN', 'DIGER',
] as const;

const TAKVIM_TARIHI = /^\d{4}-\d{2}-\d{2}$/;
const TARIH_MESAJI = 'Tarih YYYY-MM-DD biçiminde olmalıdır (saat bilgisi taşıyamaz).';

export class SakinEkleDto {
  @ApiProperty({ description: 'Fiilen oturan kişi.' })
  @IsUUID()
  kisiId!: string;

  @ApiPropertyOptional({
    enum: YAKINLIK_DERECELERI, example: 'ES',
    description: 'KENDISI: malik ya da kiracının kendisi oturuyor.',
  })
  @IsOptional() @IsIn(YAKINLIK_DERECELERI)
  yakinlikDerecesi?: (typeof YAKINLIK_DERECELERI)[number];

  @ApiProperty({ example: '2026-01-01' })
  @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  girisTarihi!: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Boşsa sakin hâlen oturuyor.' })
  @IsOptional() @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  cikisTarihi?: string;

  @ApiPropertyOptional({ example: 'Ayşe Yılmaz' })
  @IsOptional() @IsString() @Length(2, 120)
  acilDurumKisiAdi?: string;

  @ApiPropertyOptional({ example: '+905321234567' })
  @IsOptional() @IsString() @Length(5, 24)
  acilDurumTelefon?: string;
}

/**
 * Sakin bilgisi düzeltme. KİŞİ değiştirilemez — kaydın kimliğidir.
 * Yanlış kişi girildiyse çıkış verilip doğru kişiyle yeni kayıt açılır.
 */
export class SakinDuzeltDto {
  @ApiPropertyOptional({ enum: YAKINLIK_DERECELERI })
  @IsOptional() @IsIn(YAKINLIK_DERECELERI)
  yakinlikDerecesi?: (typeof YAKINLIK_DERECELERI)[number];

  @ApiPropertyOptional({ example: '2026-02-01', description: 'Giriş tarihi düzeltmesi.' })
  @IsOptional() @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  girisTarihi?: string;

  @ApiPropertyOptional({ example: 'Ayşe Yılmaz' })
  @IsOptional() @IsString() @Length(2, 120)
  acilDurumKisiAdi?: string;

  @ApiPropertyOptional({ example: '+905321234567' })
  @IsOptional() @IsString() @Length(5, 24)
  acilDurumTelefon?: string;
}

export class SakinCikisDto {
  @ApiProperty({
    example: '2026-12-31',
    description: 'Çıkış günü. Giriş tarihinden önce olamaz. Kayıt SİLİNMEZ.',
  })
  @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  cikisTarihi!: string;
}
