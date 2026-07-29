import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min, MinLength,
} from 'class-validator';

export const ARAC_TURLERI = [
  'OTOMOBIL', 'MOTOSIKLET', 'TICARI', 'BISIKLET', 'DIGER',
] as const;

export class AracEkleDto {
  @ApiProperty({ description: 'Aracın bağlı olduğu bağımsız bölüm.' })
  @IsUUID()
  bolumId!: string;

  @ApiProperty({ description: 'Aracın sahibi ya da kullanıcısı — malik, kiracı veya sakin.' })
  @IsUUID()
  kisiId!: string;

  /**
   * Plaka NORMALİZE edilerek saklanır (boşluksuz, büyük harf). "34 ABC 123"
   * ve "34abc123" AYNI araçtır; normalize edilmezse mükerrer denetimi
   * çalışmaz ve bir araç iki daireye sayılır.
   */
  @ApiProperty({ example: '34 ABC 123' })
  @IsString() @Length(5, 16)
  plaka!: string;

  @ApiPropertyOptional({ enum: ARAC_TURLERI, example: 'OTOMOBIL' })
  @IsOptional() @IsIn(ARAC_TURLERI)
  tur?: (typeof ARAC_TURLERI)[number];

  @ApiPropertyOptional({ example: 'Renault' })
  @IsOptional() @IsString() @Length(1, 40)
  marka?: string;

  @ApiPropertyOptional({ example: 'Clio' })
  @IsOptional() @IsString() @Length(1, 40)
  model?: string;

  @ApiPropertyOptional({ example: 'Beyaz' })
  @IsOptional() @IsString() @Length(1, 24)
  renk?: string;

  @ApiPropertyOptional({
    example: 'B-14',
    description: 'Tahsisli otopark yeri. Boşsa araç kayıtlı ama yer tahsisli değil.',
  })
  @IsOptional() @IsString() @Length(1, 24)
  otoparkYeri?: string;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString({}, { message: 'Başlangıç YYYY-MM-DD biçiminde olmalıdır.' })
  baslangic!: string;

  @ApiPropertyOptional({ example: null, description: 'Boşsa kayıt açık uçludur.' })
  @IsOptional() @IsDateString()
  bitis?: string;
}

/**
 * Kısmi güncelleme.
 *
 * `bolumId`, `kisiId`, `plaka` ve `baslangic` DEĞİŞTİRİLEMEZ: dördü birlikte
 * kaydın kimliğidir. Yanlış plakayla ya da yanlış daireye açılmış kayıt
 * düzeltilmez — sonlandırılıp yenisi açılır. Aksi halde geçmiş bir ayın
 * otopark dağıtımı, bugün yapılan bir düzeltmeyle sessizce değişirdi.
 */
export class AracDuzeltDto {
  @ApiPropertyOptional({ enum: ARAC_TURLERI })
  @IsOptional() @IsIn(ARAC_TURLERI)
  tur?: (typeof ARAC_TURLERI)[number];

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 40)
  marka?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 40)
  model?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 24)
  renk?: string;

  @ApiPropertyOptional({ example: 'B-14' })
  @IsOptional() @IsString() @Length(1, 24)
  otoparkYeri?: string;
}

export class AracSonlandirDto {
  @ApiProperty({ example: '2026-06-30', description: 'Kaydın kapanış tarihi.' })
  @IsDateString({}, { message: 'Bitiş YYYY-MM-DD biçiminde olmalıdır.' })
  bitis!: string;

  @ApiProperty({
    example: 'Araç satıldı, sakin bildirdi',
    description: 'Sonlandırma gerekçesi denetim kaydına yazılır.',
  })
  @IsString() @MinLength(5)
  gerekce!: string;
}

export class OtoparkHakkiDto {
  @ApiProperty({ example: 1, description: 'Yönetim planının bölüme tanıdığı yer sayısı.' })
  @IsInt() @Min(0) @Max(50)
  hakSayisi!: number;
}
