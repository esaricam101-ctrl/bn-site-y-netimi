import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional, IsString, IsUUID, Length, Matches, MinLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { KisiGirdisiDto } from '../../../common/kayit/kisi-girdisi.dto';

const TAKVIM_TARIHI = /^\d{4}-\d{2}-\d{2}$/;
const TARIH_MESAJI = 'Tarih YYYY-MM-DD biçiminde olmalıdır (saat bilgisi taşıyamaz).';

/**
 * Kefil bilgisi.
 *
 * KEFİL AYRI BİR `Kisi` KAYDI OLARAK AÇILMAZ. Yönetimin ortak gider alacağı
 * malike (KMK md. 20) ve kiracıya (md. 22, kira bedeli kadar müteselsil)
 * yönelir; KEFİLE YÖNELMEZ — kefalet, malik ile kiracı arasındaki kira
 * sözleşmesinin tarafıdır, yönetim planının değil. `Kisi` kaydı açılsaydı
 * kefil borç sorumluluğu sorgularında görünürdü.
 */
export class KefilDto {
  @ApiProperty({ example: 'Mehmet Yılmaz' })
  @IsString() @Length(3, 120)
  adSoyad!: string;

  @ApiPropertyOptional({ example: '12345678901' })
  @IsOptional()
  @Matches(/^[0-9]{11}$/u, { message: 'TC kimlik no 11 haneli ve yalnızca rakam olmalıdır.' })
  tcKimlikNo?: string;

  @ApiPropertyOptional({ example: '05321234567' })
  @IsOptional() @IsString() @Length(7, 32)
  telefon?: string;

  @ApiPropertyOptional({ example: 'Kadıköy / İstanbul' })
  @IsOptional() @IsString() @Length(5, 500)
  adres?: string;
}

export class KiraciEkleDto {
  /**
   * KİŞİ SEÇME ZORUNLU DEĞİLDİR. `kisiId` verilirse mevcut kişi kullanılır;
   * verilmezse `kisi` bölümündeki bilgilerden oluşturulur.
   */
  @ApiPropertyOptional({
    description: 'Mevcut kira sözleşmesi tarafı. Şirket de kiracı olabilir.',
  })
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

  @ApiPropertyOptional({ type: KefilDto })
  @IsOptional() @ValidateNested() @Type(() => KefilDto)
  kefil?: KefilDto;

  @ApiProperty({ example: '2026-01-01' })
  @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  baslangic!: string;

  @ApiPropertyOptional({
    example: '2027-01-01',
    description: 'Boş bırakılırsa sözleşme süresizdir ve sonraki her dönemi bloke eder.',
  })
  @IsOptional() @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  bitis?: string;

  @ApiPropertyOptional({ example: 'K-2026-014' })
  @IsOptional() @IsString() @Length(1, 40)
  sozlesmeNo?: string;

  @ApiPropertyOptional({ example: '2025-12-20' })
  @IsOptional() @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  sozlesmeTarihi?: string;

  /**
   * Depozito para değeridir ve METİN taşınır — JSON `number` float'tır,
   * para asla float olmaz (BFS v1 §11 · ADR-0007).
   */
  @ApiPropertyOptional({ example: '25000.00', description: 'Para değeri metin olarak.' })
  @IsOptional()
  @Matches(/^\d+(\.\d{1,4})?$/, { message: 'Depozito en fazla 4 ondalık basamaklı pozitif sayı olmalıdır.' })
  depozito?: string;
}

/**
 * Sözleşme bilgisi düzeltme. KİŞİ ve BAŞLANGIÇ tarihi değiştirilemez:
 * ikisi de sözleşmenin kimliğidir. Yanlış kişiye açılmış bir sözleşme
 * düzeltilmez — tahliye edilip doğru kişiyle yenisi açılır.
 */
export class KiraciDuzeltDto {
  @ApiPropertyOptional({ example: 'K-2026-014' })
  @IsOptional() @IsString() @Length(1, 40)
  sozlesmeNo?: string;

  @ApiPropertyOptional({ example: '2025-12-20' })
  @IsOptional() @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  sozlesmeTarihi?: string;

  @ApiPropertyOptional({ example: '25000.00', description: 'Para değeri metin olarak.' })
  @IsOptional()
  @Matches(/^\d+(\.\d{1,4})?$/, { message: 'Depozito en fazla 4 ondalık basamaklı pozitif sayı olmalıdır.' })
  depozito?: string;

  @ApiPropertyOptional({
    example: '2027-06-30',
    description: 'Sözleşme bitişi (uzatma/kısaltma). Başlangıçtan önce olamaz.',
  })
  @IsOptional() @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  bitis?: string;

  @ApiPropertyOptional({ type: KefilDto, description: 'Kefil bilgisi düzeltmesi.' })
  @IsOptional() @ValidateNested() @Type(() => KefilDto)
  kefil?: KefilDto;
}

export class KiraciTahliyeDto {
  @ApiProperty({
    example: '2026-12-31',
    description: 'Tahliye günü. Sözleşme başlangıcından önce olamaz.',
  })
  @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  tahliyeTarihi!: string;

  @ApiProperty({ example: 'Kiracı kendi isteğiyle taşındı' })
  @IsString() @MinLength(5, { message: 'Tahliye gerekçesi en az 5 karakter olmalıdır.' })
  tahliyeGerekcesi!: string;

  @ApiPropertyOptional({
    example: '2027-01-15',
    description: 'Depozito iadesi yapıldıysa tarihi.',
  })
  @IsOptional() @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  depozitoIadeTarihi?: string;
}
