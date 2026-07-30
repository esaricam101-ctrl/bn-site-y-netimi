import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn, IsOptional, IsString, IsUUID, Length, Matches, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { KisiGirdisiDto } from '../../../common/kayit/kisi-girdisi.dto';

/**
 * Yakınlık dereceleri.
 *
 * ⚠️  `ANNE_BABA` · `AKRABA` · `MISAFIR` · `CALISAN` ESKİ değerlerdir. Yeni
 *     kayıtlarda kullanılmaz ama listeden ÇIKARILMAZ: geçmiş kayıtların
 *     düzeltilebilmesi için DTO'nun onları kabul etmesi gerekir. Çıkarılsaydı
 *     eski bir sakinin giriş tarihini düzeltmek bile 400 dönerdi.
 */
export const YAKINLIK_DERECELERI = [
  'KENDISI', 'ES', 'COCUK', 'ANNE', 'BABA', 'KARDES', 'DIGER',
  // --- geriye dönük ---
  'ANNE_BABA', 'AKRABA', 'MISAFIR', 'CALISAN',
] as const;

/** Formda gösterilen güncel seçenekler (eski değerler hariç). */
export const YAKINLIK_SECENEKLERI = [
  'KENDISI', 'ES', 'COCUK', 'ANNE', 'BABA', 'KARDES', 'DIGER',
] as const;

const TAKVIM_TARIHI = /^\d{4}-\d{2}-\d{2}$/;
const TARIH_MESAJI = 'Tarih YYYY-MM-DD biçiminde olmalıdır (saat bilgisi taşıyamaz).';

export class SakinEkleDto {
  /**
   * KİŞİ SEÇME ZORUNLU DEĞİLDİR. `kisiId` verilirse mevcut kişi kullanılır;
   * verilmezse `kisi` bölümündeki bilgilerden oluşturulur.
   */
  @ApiPropertyOptional({ description: 'Fiilen oturan mevcut kişi.' })
  @IsOptional() @IsUUID()
  kisiId?: string;

  @ApiPropertyOptional({
    type: KisiGirdisiDto,
    description:
      'Formun "Kişi Bilgileri" bölümü. TC kimlik no verilirse aynı numaralı ' +
      'mevcut kişi kullanılır — mükerrer kimlik kaydı açılmaz.',
  })
  @IsOptional() @ValidateNested() @Type(() => KisiGirdisiDto)
  kisi?: KisiGirdisiDto;

  /*
   * ⚠️  DAYANAK ZORUNLUDUR: sakin ya bir MALİKE ya bir KİRACIYA bağlanır,
   *     TAM OLARAK BİRİNE. Bağ olmasaydı "bu kişi burada kimin yakını olarak
   *     oturuyor" sorusu yanıtsız kalırdı: kiracı taşındığında ailesinin
   *     akıbeti belirsiz olur, acil durumda çocuğun velisi bulunamazdı.
   *
   *     Veritabanı da zorlar (CHECK `sakin_dayanak_tek` + bileşik FK), bu
   *     yüzden kural iki kez korunur.
   */
  @ApiPropertyOptional({
    description:
      'Sakinin dayandığı MALİK. `kiraciId` ile birlikte verilemez; ikisinden ' +
      'TAM OLARAK BİRİ zorunludur.',
  })
  @IsOptional() @IsUUID()
  malikId?: string;

  @ApiPropertyOptional({
    description: 'Sakinin dayandığı KİRACI. `malikId` ile birlikte verilemez.',
  })
  @IsOptional() @IsUUID()
  kiraciId?: string;

  @ApiPropertyOptional({
    enum: YAKINLIK_SECENEKLERI, example: 'ES',
    description:
      'Eşi · Çocuğu · Annesi · Babası · Kardeşi · Diğer.\n\n' +
      '`KENDISI`: malik ya da kiracının KENDİSİ oturuyor — en yaygın durum.\n\n' +
      '⚠️  `DIGER` seçilirse `yakinlikAciklamasi` ZORUNLUDUR (Amcası · ' +
      'Bakıcısı · Refakatçisi…).',
  })
  @IsOptional() @IsIn(YAKINLIK_DERECELERI)
  yakinlikDerecesi?: (typeof YAKINLIK_DERECELERI)[number];

  @ApiPropertyOptional({
    example: 'Amcası',
    description:
      '`DIGER` seçildiğinde ZORUNLU serbest metin. Sabit liste tek başına ' +
      'kullanılsaydı listede olmayan her ilişki "Diğer" olarak kaydedilir ve ' +
      'bilgi KAYBOLURDU.',
  })
  @IsOptional() @IsString() @Length(2, 80)
  yakinlikAciklamasi?: string;

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
  @ApiPropertyOptional({ enum: YAKINLIK_SECENEKLERI })
  @IsOptional() @IsIn(YAKINLIK_DERECELERI)
  yakinlikDerecesi?: (typeof YAKINLIK_DERECELERI)[number];

  @ApiPropertyOptional({
    example: 'Bakıcısı',
    description: '`DIGER` seçiliyken ZORUNLU; başka derecede boşaltılır.',
  })
  @IsOptional() @IsString() @Length(2, 80)
  yakinlikAciklamasi?: string;

  @ApiPropertyOptional({
    description:
      'Dayanağı DEĞİŞTİRİR (malikten kiracıya ya da tersi). İkisinden yalnızca ' +
      'biri verilebilir.',
  })
  @IsOptional() @IsUUID()
  malikId?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  kiraciId?: string;

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
