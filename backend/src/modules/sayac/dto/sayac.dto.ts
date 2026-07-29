import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean, IsDateString, IsIn, IsInt, IsNumberString, IsOptional,
  IsString, IsUUID, Length, Max, Min, MinLength,
} from 'class-validator';

export const SAYAC_TURLERI = [
  'SU', 'SICAK_SU', 'ELEKTRIK', 'DOGALGAZ', 'ISI_PAY_OLCER', 'KALORIMETRE',
] as const;

export const OKUMA_KAYNAKLARI = ['ELLE', 'UZAKTAN', 'ICE_AKTARIM'] as const;

export class SayacTakDto {
  @ApiProperty()
  @IsUUID()
  bolumId!: string;

  @ApiProperty({ enum: SAYAC_TURLERI, example: 'SU' })
  @IsIn(SAYAC_TURLERI)
  tur!: (typeof SAYAC_TURLERI)[number];

  @ApiProperty({ example: 'SU-2026-0043' })
  @IsString() @Length(2, 40)
  seriNo!: string;

  @ApiProperty({
    example: 5,
    description:
      'Gösterge basamak sayısı. Devir hesabı (99999 → 00001) buna dayanır; ' +
      'yanlış girilirse devir tüketimi kat kat yanlış çıkar.',
  })
  @IsInt() @Min(1) @Max(12)
  basamak!: number;

  @ApiPropertyOptional({
    example: 3,
    description: 'Okumadaki ondalık basamak. 12,345 m³ → değer 12345, ölçek 3.',
  })
  @IsOptional() @IsInt() @Min(0) @Max(6)
  olcekBasamak?: number;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString({}, { message: 'Takılma tarihi YYYY-MM-DD biçiminde olmalıdır.' })
  takilmaTarihi!: string;

  /**
   * Değerler TAM SAYI ve METİN taşınır. JSON `number` 2^53'ü aşan sayaç
   * değerlerinde kayar; ondalık ise float yuvarlaması yapar (ADR-0007).
   */
  @ApiPropertyOptional({
    example: '0',
    description: 'Takıldığı andaki gösterge. Kullanılmış sayaçta sıfır olmaz.',
  })
  @IsOptional()
  @IsNumberString({ no_symbols: true }, { message: 'İlk değer yalnızca rakam içermelidir.' })
  ilkDeger?: string;

  @ApiPropertyOptional({
    description:
      'Bu sayaç hangi sayacın yerine takıldı. Verilirse eski sayaç aynı ' +
      'işlemde sökülür ve değişim zinciri kurulur.',
  })
  @IsOptional() @IsUUID()
  oncekiSayacId?: string;
}

export class SayacSokDto {
  @ApiProperty({ example: '2026-06-30' })
  @IsDateString({}, { message: 'Sökülme tarihi YYYY-MM-DD biçiminde olmalıdır.' })
  sokulmeTarihi!: string;

  @ApiProperty({ example: 'Sayaç arızalandı, yenisi takıldı' })
  @IsString() @MinLength(5)
  gerekce!: string;
}

export class OkumaEkleDto {
  @ApiProperty({ example: '2026-07-31' })
  @IsDateString({}, { message: 'Okuma tarihi YYYY-MM-DD biçiminde olmalıdır.' })
  tarih!: string;

  @ApiProperty({ example: '12345', description: 'Gösterge değeri — TAM SAYI, metin taşınır.' })
  @IsNumberString({ no_symbols: true }, { message: 'Okuma değeri yalnızca rakam içermelidir.' })
  deger!: string;

  /**
   * Devir TAHMİN EDİLMEZ. Bir okuma öncekinden küçükse iki olasılık vardır:
   * sayaç devretti ya da değer yanlış girildi. Tahmin etmek, veri girişi
   * hatasını devir sanıp gerçekte olmayan bir tüketim yazmaya yol açar.
   */
  @ApiPropertyOptional({
    example: false,
    description:
      'Gösterge başa döndüyse true. Varsayılan false: küçülen okuma REDDEDİLİR.',
  })
  @IsOptional() @IsBoolean()
  devirMi?: boolean;

  @ApiPropertyOptional({ enum: OKUMA_KAYNAKLARI, example: 'ELLE' })
  @IsOptional() @IsIn(OKUMA_KAYNAKLARI)
  kaynak?: (typeof OKUMA_KAYNAKLARI)[number];

  @ApiPropertyOptional({ example: 'Kapıcı okudu, fotoğraf arşivde' })
  @IsOptional() @IsString() @Length(1, 500)
  notu?: string;
}
