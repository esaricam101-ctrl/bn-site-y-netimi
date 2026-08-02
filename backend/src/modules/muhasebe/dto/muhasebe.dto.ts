import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Length,
  Matches, Max, Min, MinLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const HESAP_TIPLERI = ['VARLIK', 'BORC', 'OZKAYNAK', 'GELIR', 'GIDER'] as const;
export const HESAP_OZELLIKLERI = ['NORMAL', 'KASA', 'BANKA', 'YANSITMA'] as const;
export const FIS_TURLERI = [
  // TAHAKKUK (ADR-0017 · 0032): MAHSUP'a sıkıştırılsaydı dönem kapanışı ve
  // raporlar tahakkuk fişini ayırt edemezdi.
  'ACILIS', 'MAHSUP', 'TAHAKKUK', 'TAHSILAT', 'TEDIYE', 'YANSITMA', 'KAPANIS',
] as const;
export const FIS_DURUMLARI = ['TASLAK', 'ISLENDI', 'TERS_KAYITLI'] as const;

const TAKVIM_TARIHI = /^\d{4}-\d{2}-\d{2}$/;
const TARIH_MESAJI = 'Tarih YYYY-MM-DD biçiminde olmalıdır (saat bilgisi taşıyamaz).';
/** Para METİN taşınır — JSON `number` float'tır (ADR-0007 · BFS v1 §11). */
const PARA = /^\d+(\.\d{1,4})?$/;

/* --------------------------------- Hesap --------------------------------- */

export class HesapEkleDto {
  @ApiProperty({
    example: '100.01',
    description:
      'Tekdüzen hesap kodu. Yalnızca rakam ve nokta; kod sıralaması mizanın ' +
      'satır sırasını belirler, harf karışık sıralar.',
  })
  @IsString() @Length(1, 20)
  kod!: string;

  @ApiProperty({ example: 'Merkez Kasa' })
  @IsString() @Length(2, 120)
  ad!: string;

  @ApiProperty({ enum: HESAP_TIPLERI, example: 'VARLIK' })
  @IsIn(HESAP_TIPLERI)
  tip!: (typeof HESAP_TIPLERI)[number];

  @ApiPropertyOptional({
    enum: HESAP_OZELLIKLERI,
    description:
      'Kasa/Banka Defteri bu alana dayanır, hesap KODUNA değil: kod planı ' +
      'tenant\'a göre değişir ve "100" her tenant\'ta kasa olmayabilir.',
  })
  @IsOptional() @IsIn(HESAP_OZELLIKLERI)
  ozellik?: (typeof HESAP_OZELLIKLERI)[number];

  @ApiPropertyOptional({
    description:
      'Üst hesap. Verilirse kod, üst hesabın kodu ile başlamak ZORUNDADIR ve ' +
      'üst hesap otomatik olarak "fiş kesilemez" olur.',
  })
  @IsOptional() @IsUUID()
  ustHesapId?: string;
}

/**
 * Hesap düzeltme. KOD ve TİP DEĞİŞTİRİLEMEZ.
 *
 * Kod değişirse geçmiş mizanların satır sırası değişir ve yayımlanmış
 * raporlarla tutmaz. Tip değişirse hesap bilançodan gelir tablosuna atlar ve
 * geçmiş dönemlerin sonucu sessizce başkalaşır.
 */
export class HesapDuzeltDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 120)
  ad?: string;

  @ApiPropertyOptional({ enum: HESAP_OZELLIKLERI })
  @IsOptional() @IsIn(HESAP_OZELLIKLERI)
  ozellik?: (typeof HESAP_OZELLIKLERI)[number];

  @ApiPropertyOptional({ description: 'Pasif hesaba fiş kesilemez.' })
  @IsOptional() @IsBoolean()
  aktif?: boolean;
}

export class HesapSilDto {
  @ApiProperty({
    example: 'Mükerrer hesap; doğru hesap 100.02 olarak açıldı',
    description: 'Soft delete gerekçesi zorunludur (BFS v1 §5.2).',
  })
  @IsString() @MinLength(10, { message: 'Silme gerekçesi en az 10 karakter olmalıdır.' })
  gerekce!: string;
}

/* ---------------------------------- Fiş ---------------------------------- */

export class FisSatirDto {
  @ApiProperty()
  @IsUUID()
  hesapId!: string;

  @ApiPropertyOptional({
    example: '1500.00',
    description:
      'Para METİN taşınır: JSON number çift duyarlıklı float\'tır ve borç/alacak ' +
      'denkliği 0,01 sapar. Bir satırda borç VEYA alacak dolu olur.',
  })
  @IsOptional() @Matches(PARA, { message: 'Tutar en fazla 4 ondalık basamaklı pozitif sayı olmalıdır.' })
  borc?: string;

  @ApiPropertyOptional({ example: '0' })
  @IsOptional() @Matches(PARA, { message: 'Tutar en fazla 4 ondalık basamaklı pozitif sayı olmalıdır.' })
  alacak?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 500)
  aciklama?: string;

  @ApiPropertyOptional({ description: 'Masraf yeri — bağımsız bölüm bazlı takip.' })
  @IsOptional() @IsUUID()
  bolumId?: string;
}

export class FisEkleDto {
  @ApiProperty({ example: '2026-07-30' })
  @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  tarih!: string;

  @ApiProperty({ example: 'Temmuz 2026 aidat tahsilatı' })
  @IsString() @Length(3, 500)
  aciklama!: string;

  @ApiPropertyOptional({ enum: FIS_TURLERI, example: 'MAHSUP' })
  @IsOptional() @IsIn(FIS_TURLERI)
  fisTuru?: (typeof FIS_TURLERI)[number];

  @ApiProperty({
    type: [FisSatirDto],
    description:
      'En az İKİ satır (çift kayıt). Borç toplamı alacak toplamına EŞİT ' +
      'olmalıdır; aksi hâlde mizan tutmaz ve bilanço açıklanamaz bir farkla ' +
      'kapanır.',
  })
  @IsArray() @ValidateNested({ each: true }) @Type(() => FisSatirDto)
  satirlar!: FisSatirDto[];

  @ApiPropertyOptional({
    description:
      'true ise fiş aynı işlemde İŞLENİR (deftere girer). false/boş ise TASLAK ' +
      'kalır ve mizanda görünmez.',
  })
  @IsOptional() @IsBoolean()
  hemenIsle?: boolean;

  @ApiPropertyOptional({ example: 'MANUEL' })
  @IsOptional() @IsString() @Length(2, 40)
  kaynakTipi?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  kaynakId?: string;
}

export class FisStornoDto {
  @ApiProperty({
    example: 'Yanlış hesaba kaydedildi; 2026/14 sayılı yönetim kararı',
    description:
      'Ters kayıt gerekçesi ZORUNLUDUR: denetimde "bu kayıt neden düzeltildi" ' +
      'sorusunun cevabı buradadır.',
  })
  @IsString() @MinLength(5, { message: 'Gerekçe en az 5 karakter olmalıdır.' })
  gerekce!: string;

  @ApiPropertyOptional({
    example: '2026-07-30',
    description:
      'Ters kayıt tarihi. Boş bırakılırsa BUGÜN. Orijinalin dönemi kapanmış ' +
      'olabilir; düzeltme AÇIK dönemde yapılır.',
  })
  @IsOptional() @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  tarih?: string;
}

/* --------------------------------- Dönem --------------------------------- */

export class DonemAcDto {
  @ApiProperty({ example: 2027 })
  @IsInt() @Min(2000) @Max(2100)
  maliYil!: number;

  @ApiProperty({ example: '2027 Mali Yılı' })
  @IsString() @Length(3, 60)
  ad!: string;

  @ApiProperty({ example: '2027-01-01' })
  @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  baslangic!: string;

  @ApiProperty({ example: '2027-12-31' })
  @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  bitis!: string;
}

export class DonemKapatDto {
  @ApiProperty({
    example: '2026 mali yılı genel kurul onayıyla kapatıldı — karar 2027/2',
    description:
      'Kapanış GERİ ALINAMAZ; hangi kararla yapıldığı kayıtta durmalıdır. ' +
      'En az 10 karakter.',
  })
  @IsString() @MinLength(10, { message: 'Kapanış gerekçesi en az 10 karakter olmalıdır.' })
  gerekce!: string;
}

/* ------------------------------ Parametreler ----------------------------- */

export class ParametreKaydetDto {
  @ApiPropertyOptional({ description: 'Varsayılan kasa hesabı.' })
  @IsOptional() @IsUUID()
  varsayilanKasaHesapId?: string;

  @ApiPropertyOptional({ description: 'Varsayılan banka hesabı.' })
  @IsOptional() @IsUUID()
  varsayilanBankaHesapId?: string;

  @ApiPropertyOptional({
    description:
      'Dönem kâr/zararının aktarıldığı özkaynak hesabı. Tanımlı değilse dönem ' +
      'kapatılamaz.',
  })
  @IsOptional() @IsUUID()
  donemKariHesapId?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional() @IsInt() @Min(1)
  yevmiyeBaslangicNo?: number;

  @ApiPropertyOptional({
    description:
      'TASLAK fişin mizanda görünüp görünmeyeceği. Varsayılan HAYIR: ' +
      'işlenmemiş bir kayıt mali tabloya giremez.',
  })
  @IsOptional() @IsBoolean()
  taslakMizanaGirer?: boolean;

  @ApiPropertyOptional({
    example: 0,
    description:
      'Geriye dönük kayıt penceresi (gün). 0 = sınırsız. Kapalı dönem yasağı ' +
      'bundan BAĞIMSIZDIR ve her zaman geçerlidir.',
  })
  @IsOptional() @IsInt() @Min(0) @Max(3650)
  geriyeDonukGun?: number;
}
