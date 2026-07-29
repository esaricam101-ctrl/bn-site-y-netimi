/**
 * Hızlı kayıt — kişi bilgilerinin FORM İÇİNDE girilmesi.
 *
 * Malik · kiracı · sakin eklerken önce "Kişiler"e gidip kayıt açmak, sonra o
 * kişiyi seçmek zorunluydu. Bu iki ekranlı akış, sahada tek işlem olan bir
 * şeyi (daireye yeni kiracı girdi) ikiye bölüyordu. Artık `kisiId` İSTEĞE
 * BAĞLIDIR: verilmezse kişi bu bilgilerden oluşturulur.
 *
 * ⚠️  MÜKERRER KİMLİK KAYDI ÖNLENİR. `kisiId` zorunluluğunun asıl işlevi,
 *     aynı kişi için ikinci bir `Kisi` satırı açılmasını engellemekti; aynı
 *     kişi iki satıra bölünürse borç geçmişi, tahakkuk sorumluluğu ve KVKK
 *     silme talebi iki ayrı kayda dağılır. Zorunluluk kaldırıldığı için
 *     tekilleştirme TC KİMLİK NUMARASI üzerinden yapılır (`kisiyiCoz`).
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray, IsDateString, IsIn, IsOptional, IsString, IsUUID, Length, Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const CINSIYETLER = ['KADIN', 'ERKEK', 'BELIRTILMEMIS'] as const;

export const ARAC_TURLERI = [
  'OTOMOBIL', 'MOTOSIKLET', 'TICARI', 'BISIKLET', 'DIGER',
] as const;

/** Kişi bilgileriyle birlikte girilen araç plakası. */
export class PlakaGirdisiDto {
  @ApiProperty({ example: '34ABC123' })
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
    example: 'B1-14',
    description:
      'Tahsisli otopark yeri etiketi. Boşsa araç kayıtlı ama yer tahsisli değil.',
  })
  @IsOptional() @IsString() @Length(1, 24)
  otoparkYeri?: string;
}

/**
 * Formun ilk bölümü — "Kişi Bilgileri".
 *
 * `kisiId` verilirse mevcut kişi kullanılır ve diğer alanlar YOK SAYILIR:
 * var olan bir kimlik kaydını yan kapıdan güncellemek, malikin adını kiracı
 * eklerken değiştirmek gibi sonuçlar üretirdi. Kişi bilgisi düzeltmesi
 * `PATCH /kisiler/:id` ile yapılır.
 */
export class KisiGirdisiDto {
  @ApiPropertyOptional({
    description:
      'Mevcut kişi. Verilirse aşağıdaki alanlar yok sayılır. Verilmezse ' +
      '`ad` ve `soyad` zorunludur.',
  })
  @IsOptional() @IsUUID()
  kisiId?: string;

  @ApiPropertyOptional({ example: 'Ayşe' })
  @IsOptional() @IsString() @Length(2, 60)
  ad?: string;

  @ApiPropertyOptional({ example: 'Yılmaz' })
  @IsOptional() @IsString() @Length(2, 60)
  soyad?: string;

  /**
   * TC kimlik no MÜKERRER KAYIT DENETİMİNİN dayanağıdır: aynı numarayla
   * kayıtlı kişi varsa yeni satır açılmaz, o kişi kullanılır.
   */
  @ApiPropertyOptional({ example: '12345678901' })
  @IsOptional()
  @Matches(/^[0-9]{11}$/u, { message: 'TC kimlik no 11 haneli ve yalnızca rakam olmalıdır.' })
  tcKimlikNo?: string;

  @ApiPropertyOptional({ example: '05321234567' })
  @IsOptional() @IsString() @Length(7, 32)
  telefon?: string;

  @ApiPropertyOptional({ example: 'ayse@ornek.test' })
  @IsOptional() @IsString() @Length(5, 180)
  eposta?: string;

  @ApiPropertyOptional({ example: '1985-04-17' })
  @IsOptional()
  @IsDateString({}, { message: 'Doğum tarihi YYYY-MM-DD biçiminde olmalıdır.' })
  dogumTarihi?: string;

  @ApiPropertyOptional({ enum: CINSIYETLER, example: 'KADIN' })
  @IsOptional() @IsIn(CINSIYETLER)
  cinsiyet?: (typeof CINSIYETLER)[number];

  @ApiPropertyOptional({ example: 'Bahçelievler Mah. 12. Sk. No 4/7 İstanbul' })
  @IsOptional() @IsString() @Length(5, 500)
  adres?: string;

  @ApiPropertyOptional({ example: 'İkinci telefonu 0212 555 44 33' })
  @IsOptional() @IsString() @Length(1, 2000)
  notlar?: string;

  @ApiPropertyOptional({
    type: [PlakaGirdisiDto],
    description:
      'Birden fazla plaka eklenebilir. Her plaka `arac` kütüğüne bu kişi ' +
      'adına yazılır; mükerrer plaka reddedilir.',
  })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PlakaGirdisiDto)
  plakalar?: PlakaGirdisiDto[];
}
