import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Length, Matches, MinLength } from 'class-validator';

const TAKVIM_TARIHI = /^\d{4}-\d{2}-\d{2}$/;
const TARIH_MESAJI = 'Tarih YYYY-MM-DD biçiminde olmalıdır (saat bilgisi taşıyamaz).';

export class KiraciEkleDto {
  @ApiProperty({ description: 'Kira sözleşmesinin tarafı. Şirket de kiracı olabilir.' })
  @IsUUID()
  kisiId!: string;

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
