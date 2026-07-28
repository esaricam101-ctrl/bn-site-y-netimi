import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumberString, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

export const TAPU_TURLERI = [
  'KAT_MULKIYETI', 'KAT_IRTIFAKI', 'ARSA_PAYLI', 'MIRAS_ISTIRAK', 'DIGER',
] as const;

const TAKVIM_TARIHI = /^\d{4}-\d{2}-\d{2}$/;
const TARIH_MESAJI = 'Tarih YYYY-MM-DD biçiminde olmalıdır (saat bilgisi taşıyamaz).';

export class MalikEkleDto {
  @ApiProperty({ description: 'Tapu sahibi kişi.' })
  @IsUUID()
  kisiId!: string;

  /**
   * Hisse pay/payda olarak METİN taşınır. JSON `number` çift duyarlıklı
   * float'tır; üç eşit hissede (1/3) toplam asla %100 etmez ve tahakkuk
   * kalıcı olarak bloke olur (ADR-0007 ile aynı gerekçe).
   */
  @ApiProperty({ example: '1', description: 'Hisse — PAY. Tam sayı metni.' })
  @IsNumberString({ no_symbols: true }, { message: 'Hisse payı yalnızca rakam içermelidir.' })
  hissePay!: string;

  @ApiProperty({ example: '3', description: 'Hisse — PAYDA. Tam sayı metni, sıfırdan büyük.' })
  @IsNumberString({ no_symbols: true }, { message: 'Hisse paydası yalnızca rakam içermelidir.' })
  hissePayda!: string;

  @ApiPropertyOptional({ enum: TAPU_TURLERI, example: 'KAT_MULKIYETI' })
  @IsOptional() @IsIn(TAPU_TURLERI)
  tapuTuru?: (typeof TAPU_TURLERI)[number];

  @ApiProperty({ example: '2026-01-01', description: 'Tapu devrinin başladığı gün.' })
  @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  tapuBaslangic!: string;

  @ApiPropertyOptional({
    example: '2030-12-31',
    description: 'Boş bırakılırsa malik hâlen kayıtlıdır.',
  })
  @IsOptional() @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  tapuBitis?: string;

  @ApiPropertyOptional({ example: '2026/1234' })
  @IsOptional() @IsString() @Length(1, 40)
  tapuYevmiyeNo?: string;

  // --- Vekâlet: ya tümü ya hiçbiri (C-4 hukuki görüş) ---

  @ApiPropertyOptional({ description: 'Vekil de bir kişidir. Verilirse vekaletnameNo zorunludur.' })
  @IsOptional() @IsUUID()
  vekilKisiId?: string;

  @ApiPropertyOptional({ example: '2026/5678' })
  @IsOptional() @IsString() @Length(1, 40)
  vekaletnameNo?: string;

  @ApiPropertyOptional({ example: '2027-01-01' })
  @IsOptional() @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  vekaletBitisTarihi?: string;
}

export class MalikDevretDto {
  @ApiProperty({
    example: '2026-12-31',
    description: 'Tapu döneminin son geçerli günü. Kayıt SİLİNMEZ, dönemi kapanır.',
  })
  @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  tapuBitis!: string;
}
