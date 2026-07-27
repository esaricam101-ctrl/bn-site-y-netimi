import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID, Matches } from 'class-validator';

export const ILISKI_ROLLERI = ['MALIK', 'KIRACI'] as const;

/**
 * Takvim tarihi YYYY-MM-DD'dir; saat bilgisi taşıyan bir değer takvim tarihi
 * DEĞİLDİR (BFS v1 §4.1). Saat dilimi taşıyan bir tip kullanılsaydı ilişkinin
 * başlangıcı sınırda bir gün kayar ve o günün tahakkuku yanlış kişiye giderdi.
 */
const TAKVIM_TARIHI = /^\d{4}-\d{2}-\d{2}$/;
const TARIH_MESAJI = 'Tarih YYYY-MM-DD biçiminde olmalıdır (saat bilgisi taşıyamaz).';

export class IliskiKurDto {
  @ApiProperty({ description: 'Malik ya da kiracı olarak bağlanacak kişi.' })
  @IsUUID()
  kisiId!: string;

  @ApiProperty({ enum: ILISKI_ROLLERI, example: 'MALIK' })
  @IsIn(ILISKI_ROLLERI)
  rol!: (typeof ILISKI_ROLLERI)[number];

  @ApiProperty({ example: '2026-01-01' })
  @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  baslangic!: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Boş bırakılırsa ilişki süresizdir ve sonraki her dönemi bloke eder.',
  })
  @IsOptional() @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  bitis?: string;
}

export class IliskiSonlandirDto {
  @ApiProperty({
    example: '2026-12-31',
    description: 'İlişkinin son geçerli günü. Başlangıçtan önce olamaz.',
  })
  @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  bitis!: string;
}
