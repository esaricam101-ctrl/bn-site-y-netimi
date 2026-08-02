import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString,
  IsUUID, Length, Max, Min, MinLength, ValidateNested,
} from 'class-validator';

/**
 * Paylaşım kuralı — giderin BÖLÜMLERE nasıl dağıtılacağı (Eksen 1).
 *
 * Liste `shared/apartman-domain/src/gider/gider-turu.ts` ile birebir aynıdır;
 * domain otoritedir. Ayrışırlarsa kural kaydedilir ama uygulanamaz.
 */
export const PAYLASIM_KURALLARI = [
  'ESIT', 'ARSA_PAYI', 'BRUT_M2', 'NET_M2', 'METREKARE', 'TUKETIM',
  'SABIT_TUTAR', 'KULLANIM_BAZLI', 'BLOK_BAZLI', 'MANUEL', 'KARMA',
] as const;

/** KARMA içinde kullanılamayanlar: KARMA'nın kendisi ve MANUEL. */
export const KARMA_BILESEN_KURALLARI = [
  'ESIT', 'ARSA_PAYI', 'BRUT_M2', 'NET_M2', 'METREKARE', 'TUKETIM',
  'SABIT_TUTAR', 'KULLANIM_BAZLI', 'BLOK_BAZLI',
] as const;

/** Sorumluluk tipi — borcun KİME yazılacağı (Eksen 2). */
export const SORUMLULUK_TIPLERI = ['MALIKE_AIT', 'KULLANANA_AIT', 'SAKINE_AIT'] as const;

/** Kural kaynağı — kuralı kimin koyduğu (Eksen 3). */
export const KURAL_KAYNAKLARI = ['KMK_VARSAYILAN', 'YONETIM_PLANI', 'GENEL_KURUL_KARARI'] as const;

/** Bölümün payının MALİKLER ARASINDA nasıl bölüneceği (Eksen 4). */
export const MALIK_PAYLASIMLARI = ['ESIT', 'HISSE_ORANI', 'MANUEL'] as const;

export class KarmaBilesenDto {
  @ApiProperty({ enum: KARMA_BILESEN_KURALLARI, example: 'BRUT_M2' })
  @IsIn(KARMA_BILESEN_KURALLARI)
  kural!: (typeof KARMA_BILESEN_KURALLARI)[number];

  @ApiProperty({ example: 70, description: 'Tam sayı yüzde. Bileşenlerin toplamı 100 olmalıdır.' })
  @IsInt() @Min(1) @Max(100)
  yuzde!: number;
}

export class GiderTuruOlusturDto {
  @ApiProperty({ example: 'ISITMA', description: 'Tenant içinde tekil kod.' })
  @IsString() @Length(2, 40)
  kod!: string;

  @ApiProperty({ example: 'Isıtma gideri' })
  @IsString() @Length(2, 120)
  ad!: string;

  @ApiProperty({ enum: PAYLASIM_KURALLARI, example: 'TUKETIM' })
  @IsIn(PAYLASIM_KURALLARI)
  paylasimKurali!: (typeof PAYLASIM_KURALLARI)[number];

  @ApiProperty({ enum: SORUMLULUK_TIPLERI, example: 'KULLANANA_AIT' })
  @IsIn(SORUMLULUK_TIPLERI)
  sorumlulukTipi!: (typeof SORUMLULUK_TIPLERI)[number];

  @ApiProperty({ enum: KURAL_KAYNAKLARI, example: 'GENEL_KURUL_KARARI' })
  @IsIn(KURAL_KAYNAKLARI)
  kuralKaynagi!: (typeof KURAL_KAYNAKLARI)[number];

  @ApiProperty({
    description:
      'TAHAKKUK FİŞİNİN ALACAK TARAFI — ZORUNLU (ADR-0017 · K1).\n\n' +
      'Hesabın niteliğini HESAP PLANI belirler: `349` gösterilirse avans, ' +
      '`600` gösterilirse gelir yaklaşımı yürür. Ürün bu tercihte taraf ' +
      'tutmaz (§33 kural 3).\n\n' +
      'Boş bırakılabilir olsaydı, karşılığı olmayan bir türün tahakkuku ya ' +
      'sessizce muhasebeleşmez ya da rastgele bir hesaba yazılırdı.',
  })
  @IsUUID()
  muhasebeHesapId!: string;

  /**
   * KMK varsayılanı DIŞINDAKİ her kural referans taşımak ZORUNDADIR.
   * Zorunluluk veritabanı kısıtında da vardır (`gider_turu_kaynak_referansi`);
   * burada yakalanması kullanıcıya anlaşılır mesaj verir.
   */
  @ApiPropertyOptional({
    example: '2026/3 sayılı genel kurul kararı',
    description: 'YONETIM_PLANI veya GENEL_KURUL_KARARI ise ZORUNLUDUR.',
  })
  @IsOptional() @IsString() @Length(3, 200)
  kaynakReferansi?: string;

  @ApiPropertyOptional({
    type: [KarmaBilesenDto],
    description: 'Yalnızca KARMA paylaşımda. Yüzdelerin toplamı 100 olmalıdır.',
  })
  @IsOptional() @IsArray() @ArrayNotEmpty()
  @ValidateNested({ each: true }) @Type(() => KarmaBilesenDto)
  karmaBilesenler?: KarmaBilesenDto[];

  @ApiPropertyOptional({ enum: MALIK_PAYLASIMLARI, example: 'HISSE_ORANI' })
  @IsOptional() @IsIn(MALIK_PAYLASIMLARI)
  malikPaylasimi?: (typeof MALIK_PAYLASIMLARI)[number];

  @ApiPropertyOptional({ example: true })
  @IsOptional() @IsBoolean()
  aktifMi?: boolean;
}

/**
 * Kısmi güncelleme.
 *
 * `kod` DEĞİŞTİRİLEMEZ: geçmiş tahakkuklar ve muhasebe kayıtları bu kodla
 * ilişkilendirilir. Yanlış kodla açılmış tür pasife alınıp yenisi açılır.
 */
export class GiderTuruGuncelleDto {
  @ApiPropertyOptional({ example: 'Isıtma gideri' })
  @IsOptional() @IsString() @Length(2, 120)
  ad?: string;

  @ApiPropertyOptional({ enum: PAYLASIM_KURALLARI })
  @IsOptional() @IsIn(PAYLASIM_KURALLARI)
  paylasimKurali?: (typeof PAYLASIM_KURALLARI)[number];

  @ApiPropertyOptional({ enum: SORUMLULUK_TIPLERI })
  @IsOptional() @IsIn(SORUMLULUK_TIPLERI)
  sorumlulukTipi?: (typeof SORUMLULUK_TIPLERI)[number];

  @ApiPropertyOptional({ enum: KURAL_KAYNAKLARI })
  @IsOptional() @IsIn(KURAL_KAYNAKLARI)
  kuralKaynagi?: (typeof KURAL_KAYNAKLARI)[number];

  @ApiPropertyOptional({ example: '2026/3 sayılı genel kurul kararı' })
  @IsOptional() @IsString() @Length(3, 200)
  kaynakReferansi?: string;

  @ApiPropertyOptional({ type: [KarmaBilesenDto] })
  @IsOptional() @IsArray()
  @ValidateNested({ each: true }) @Type(() => KarmaBilesenDto)
  karmaBilesenler?: KarmaBilesenDto[];

  @ApiPropertyOptional({ enum: MALIK_PAYLASIMLARI })
  @IsOptional() @IsIn(MALIK_PAYLASIMLARI)
  malikPaylasimi?: (typeof MALIK_PAYLASIMLARI)[number];

  @ApiPropertyOptional({ example: false })
  @IsOptional() @IsBoolean()
  aktifMi?: boolean;
}

export class GiderTuruSilDto {
  @ApiProperty({
    example: 'Mükerrer tanım; ISITMA türü kullanılacak',
    description: 'Soft delete gerekçesi zorunludur (BFS v1 §5.2).',
  })
  @IsString() @MinLength(10, { message: 'Silme gerekçesi en az 10 karakter olmalıdır.' })
  gerekce!: string;
}
