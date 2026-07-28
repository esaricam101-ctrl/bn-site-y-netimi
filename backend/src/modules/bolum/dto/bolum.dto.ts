import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayNotEmpty, IsArray, IsBoolean, IsInt, IsNumberString, IsOptional,
  IsPositive, IsString, IsIn, IsUUID, Length, Max, Min, MinLength, ValidateNested,
} from 'class-validator';

export const BOLUM_NITELIKLERI = ['MESKEN', 'ISYERI', 'DEPO', 'OTOPARK', 'ORTAK_ALAN'] as const;

export const DAIRE_TIPLERI = [
  'STUDYO', 'BIR_SIFIR', 'BIR_BIR', 'IKI_BIR', 'UC_BIR',
  'DORT_BIR', 'BES_BIR', 'DUBLEKS', 'DIGER',
] as const;

export const BOLUM_DURUMLARI = ['AKTIF', 'BOS', 'TADILATTA', 'KULLANIM_DISI'] as const;

export class BolumOlusturDto {
  @ApiPropertyOptional({ description: 'Blok kimliği. Tek bloklu apartmanlarda boş bırakılır.' })
  @IsOptional() @IsUUID()
  blokId?: string;

  @ApiPropertyOptional({ description: 'Kat kimliği. Verilirse bloğa ait olmalıdır.' })
  @IsOptional() @IsUUID()
  katId?: string;

  @ApiProperty({ example: '12' })
  @IsString() @Length(1, 16)
  kapiNo!: string;

  @ApiPropertyOptional({ example: '12A', description: 'Daire içi numara; kapı numarasından farklı olabilir.' })
  @IsOptional() @IsString() @Length(1, 16)
  icKapiNo?: string;

  @ApiProperty({ example: 3, description: 'Bodrum katlar negatif olabilir.' })
  @IsInt() @Min(-10) @Max(200)
  kat!: number;

  @ApiProperty({
    enum: BOLUM_NITELIKLERI, example: 'MESKEN',
    description: 'Tapudaki hukuki vasıf. Fiili kullanım durumu için `durum` alanı kullanılır.',
  })
  @IsIn(BOLUM_NITELIKLERI)
  nitelik!: (typeof BOLUM_NITELIKLERI)[number];

  @ApiPropertyOptional({ enum: DAIRE_TIPLERI, example: 'IKI_BIR', description: '2+1 → IKI_BIR' })
  @IsOptional() @IsIn(DAIRE_TIPLERI)
  daireTipi?: (typeof DAIRE_TIPLERI)[number];

  @ApiPropertyOptional({ example: 'konut', description: 'Fiili kullanım amacı; nitelikten ayrıdır.' })
  @IsOptional() @IsString() @Length(1, 80)
  kullanimAmaci?: string;

  @ApiPropertyOptional({
    enum: BOLUM_DURUMLARI, example: 'AKTIF',
    description: 'KULLANIM_DISI bölümler aidat dağıtımına GİRMEZ.',
  })
  @IsOptional() @IsIn(BOLUM_DURUMLARI)
  durum?: (typeof BOLUM_DURUMLARI)[number];

  @ApiProperty({ example: 120.5 })
  @IsPositive()
  brutM2!: number;

  @ApiProperty({ example: 98.25, description: 'Net m² brüt m²den büyük olamaz.' })
  @IsPositive()
  netM2!: number;

  /**
   * Arsa payı pay/payda olarak, METİN halinde taşınır. JSON `number` çift
   * duyarlıklı float'tır; 1/3 gibi paylarda yuvarlama hatası doğurur ve
   * payların toplamı KMK md. 3'ün şart koştuğu tamı tutmaz. Sunucuda `BigInt`'e
   * çevrilir; veritabanında da `BigInt`'tir.
   */
  @ApiProperty({ example: '45', description: 'Arsa payı — PAY. Tam sayı metni.' })
  @IsNumberString({ no_symbols: true }, { message: 'Arsa payı payı yalnızca rakam içermelidir.' })
  arsaPayiPay!: string;

  @ApiProperty({ example: '1000', description: 'Arsa payı — PAYDA. Tam sayı metni, sıfırdan büyük.' })
  @IsNumberString({ no_symbols: true }, { message: 'Arsa payı paydası yalnızca rakam içermelidir.' })
  arsaPayiPayda!: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Aidattan muaf bölümler (örn. yönetim odası) tahakkuka girmez.',
  })
  @IsOptional() @IsBoolean()
  aidatMuafiyeti?: boolean;

  // --- Tapu bilgileri (KMK md. 12) — hepsi isteğe bağlıdır ---

  @ApiPropertyOptional({ example: '1234' })
  @IsOptional() @IsString() @Length(1, 20)
  tapuAda?: string;

  @ApiPropertyOptional({ example: '56' })
  @IsOptional() @IsString() @Length(1, 20)
  tapuParsel?: string;

  @ApiPropertyOptional({ example: 'G21b' })
  @IsOptional() @IsString() @Length(1, 20)
  tapuPafta?: string;

  @ApiPropertyOptional({
    example: '7',
    description: 'Tapudaki bağımsız bölüm numarası; kapı numarasından FARKLI olabilir.',
  })
  @IsOptional() @IsString() @Length(1, 20)
  tapuBagimsizBolumNo?: string;

  @ApiPropertyOptional({ example: '12' })
  @IsOptional() @IsString() @Length(1, 20)
  tapuCilt?: string;

  @ApiPropertyOptional({ example: '1180' })
  @IsOptional() @IsString() @Length(1, 20)
  tapuSahife?: string;
}

/**
 * Kısmi güncelleme. ARSA PAYI ve BLOK/KAT burada DEĞİŞTİRİLEMEZ:
 *
 * - Arsa payı KMK md. 3 toplamını etkiler; tek bölümde değiştirmek binanın
 *   toplamını sessizce bozar. Ayrı bir toplu düzeltme akışı gerektirir.
 * - Blok/kat değişikliği hiyerarşi taşımasıdır; mükerrer kapı no kontrolü
 *   blok bazlı olduğu için ayrı bir "taşı" işlemi gerektirir.
 *
 * İkisi de TODO olarak bırakılmıştır (DEVLOG).
 */
export class BolumGuncelleDto {
  @ApiPropertyOptional({ example: '12' })
  @IsOptional() @IsString() @Length(1, 16)
  kapiNo?: string;

  @ApiPropertyOptional({ example: '12A' })
  @IsOptional() @IsString() @Length(1, 16)
  icKapiNo?: string;

  @ApiPropertyOptional({ enum: BOLUM_NITELIKLERI })
  @IsOptional() @IsIn(BOLUM_NITELIKLERI)
  nitelik?: (typeof BOLUM_NITELIKLERI)[number];

  @ApiPropertyOptional({ enum: DAIRE_TIPLERI })
  @IsOptional() @IsIn(DAIRE_TIPLERI)
  daireTipi?: (typeof DAIRE_TIPLERI)[number];

  @ApiPropertyOptional({ example: 'konut' })
  @IsOptional() @IsString() @Length(1, 80)
  kullanimAmaci?: string;

  @ApiPropertyOptional({ enum: BOLUM_DURUMLARI })
  @IsOptional() @IsIn(BOLUM_DURUMLARI)
  durum?: (typeof BOLUM_DURUMLARI)[number];

  @ApiPropertyOptional({ example: 120.5 })
  @IsOptional() @IsPositive()
  brutM2?: number;

  @ApiPropertyOptional({ example: 98.25 })
  @IsOptional() @IsPositive()
  netM2?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional() @IsBoolean()
  aidatMuafiyeti?: boolean;

  @ApiPropertyOptional({ example: '1234' })
  @IsOptional() @IsString() @Length(1, 20)
  tapuAda?: string;

  @ApiPropertyOptional({ example: '56' })
  @IsOptional() @IsString() @Length(1, 20)
  tapuParsel?: string;

  @ApiPropertyOptional({ example: 'G21b' })
  @IsOptional() @IsString() @Length(1, 20)
  tapuPafta?: string;

  @ApiPropertyOptional({ example: '7' })
  @IsOptional() @IsString() @Length(1, 20)
  tapuBagimsizBolumNo?: string;

  @ApiPropertyOptional({ example: '12' })
  @IsOptional() @IsString() @Length(1, 20)
  tapuCilt?: string;

  @ApiPropertyOptional({ example: '1180' })
  @IsOptional() @IsString() @Length(1, 20)
  tapuSahife?: string;
}

/**
 * Bölümleri başka bir blok/kata taşır.
 *
 * Hiyerarşi denetiminin raporladığı `KAT_BLOK_UYUSMAZLIGI`, `KATSIZ_BLOK`,
 * `BLOKSUZ_KAT` ve `HIYERARSI_DISI` sorunlarının düzeltme akışıdır.
 */
export class BolumTasiDto {
  @ApiProperty({
    type: [String],
    description: 'Taşınacak bölümler. Hepsi aynı işlemde taşınır; biri başarısız olursa hiçbiri taşınmaz.',
  })
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(500)
  @IsUUID(undefined, { each: true })
  bolumIdler!: string[];

  @ApiProperty({ description: 'Hedef blok.' })
  @IsUUID()
  hedefBlokId!: string;

  @ApiPropertyOptional({
    description: 'Hedef kat. Verilirse hedef bloğa ait olmalı; bölümün `kat` alanı bu katın numarasıyla EŞİTLENİR.',
  })
  @IsOptional() @IsUUID()
  hedefKatId?: string;

  @ApiProperty({ example: 'Blok yapılandırması yeniden düzenlendi' })
  @IsString() @MinLength(10, { message: 'Taşıma gerekçesi en az 10 karakter olmalıdır.' })
  gerekce!: string;
}

export class ArsaPayiSatiriDto {
  @ApiProperty()
  @IsUUID()
  bolumId!: string;

  @ApiProperty({ example: '45', description: 'Arsa payı — PAY. Tam sayı metni.' })
  @IsNumberString({ no_symbols: true }, { message: 'Arsa payı payı yalnızca rakam içermelidir.' })
  arsaPayiPay!: string;

  @ApiProperty({ example: '1000', description: 'Arsa payı — PAYDA. Tam sayı metni.' })
  @IsNumberString({ no_symbols: true }, { message: 'Arsa payı paydası yalnızca rakam içermelidir.' })
  arsaPayiPayda!: string;
}

/**
 * Arsa paylarını TOPLU düzeltir — KMK md. 3.
 *
 * Tek bölümün arsa payını değiştirmek binanın toplamını sessizce bozar; bu
 * yüzden `PATCH /bolumler/:id` arsa payına dokunmaz. Toplu düzeltme, işlem
 * SONUNDAKİ toplamın tamı ettiğini doğrular ve etmiyorsa hiçbir satırı yazmaz.
 */
export class ArsaPayiDuzeltDto {
  @ApiProperty({ type: [ArsaPayiSatiriDto] })
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(2000)
  @ValidateNested({ each: true }) @Type(() => ArsaPayiSatiriDto)
  satirlar!: ArsaPayiSatiriDto[];

  @ApiProperty({ example: 'Yönetim planı ekindeki arsa payı tablosuna göre düzeltildi' })
  @IsString() @MinLength(10, { message: 'Düzeltme gerekçesi en az 10 karakter olmalıdır.' })
  gerekce!: string;
}

/** Toplu oluşturmada tek satır. Hiyerarşi tüm satırlar için ortaktır. */
export class TopluBolumSatiriDto {
  @ApiProperty({ example: '12' })
  @IsString() @Length(1, 16)
  kapiNo!: string;

  @ApiPropertyOptional({ example: '12A' })
  @IsOptional() @IsString() @Length(1, 16)
  icKapiNo?: string;

  @ApiPropertyOptional({ enum: BOLUM_NITELIKLERI, example: 'MESKEN' })
  @IsOptional() @IsIn(BOLUM_NITELIKLERI)
  nitelik?: (typeof BOLUM_NITELIKLERI)[number];

  @ApiPropertyOptional({ enum: DAIRE_TIPLERI, example: 'IKI_BIR' })
  @IsOptional() @IsIn(DAIRE_TIPLERI)
  daireTipi?: (typeof DAIRE_TIPLERI)[number];

  @ApiProperty({ example: 120.5 })
  @IsPositive()
  brutM2!: number;

  @ApiProperty({ example: 98.25 })
  @IsPositive()
  netM2!: number;

  @ApiProperty({ example: '45', description: 'Arsa payı — PAY. Tam sayı metni.' })
  @IsNumberString({ no_symbols: true }, { message: 'Arsa payı payı yalnızca rakam içermelidir.' })
  arsaPayiPay!: string;

  @ApiProperty({ example: '1000', description: 'Arsa payı — PAYDA. Tam sayı metni.' })
  @IsNumberString({ no_symbols: true }, { message: 'Arsa payı paydası yalnızca rakam içermelidir.' })
  arsaPayiPayda!: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional() @IsBoolean()
  aidatMuafiyeti?: boolean;
}

/**
 * Bölümleri TOPLU oluşturur.
 *
 * Kırk daireli bir binayı tek tek girmek operasyonel olarak kullanılamaz.
 * Hiyerarşi (blok/kat) tüm satırlar için ortaktır; kat verilirse bölümlerin
 * `kat` alanı katın numarasıyla EŞİTLENİR.
 *
 * Arsa payı toplamı burada DENETLENMEZ: bina parça parça girilirken toplam
 * doğal olarak 1'in altındadır. Tamlık `arsa-payi-durumu` ile denetlenir ve
 * `arsa-payi-duzelt` ile tamamlanır.
 */
export class TopluBolumOlusturDto {
  @ApiProperty({ description: 'Bölümlerin bağlanacağı blok.' })
  @IsUUID()
  blokId!: string;

  @ApiPropertyOptional({ description: 'Kat. Verilirse bloğa ait olmalı.' })
  @IsOptional() @IsUUID()
  katId?: string;

  @ApiProperty({
    example: 3,
    description: 'Kat numarası. `katId` verilirse o katın numarasıyla eşit olmalıdır.',
  })
  @IsInt() @Min(-10) @Max(200)
  kat!: number;

  @ApiProperty({ type: [TopluBolumSatiriDto] })
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(500)
  @ValidateNested({ each: true }) @Type(() => TopluBolumSatiriDto)
  bolumler!: TopluBolumSatiriDto[];
}

export class BolumSilDto {
  @ApiProperty({
    example: 'Bölüm birleştirildi, kayıt mükerrer',
    description: 'Soft delete gerekçesi zorunludur (BFS v1 §5.2).',
  })
  @IsString() @MinLength(10, { message: 'Silme gerekçesi en az 10 karakter olmalıdır.' })
  gerekce!: string;
}
