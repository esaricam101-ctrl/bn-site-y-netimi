import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean, IsInt, IsNumberString, IsOptional, IsPositive, IsString, IsIn, IsUUID,
  Length, Max, Min, MinLength,
} from 'class-validator';

export const BOLUM_NITELIKLERI = ['MESKEN', 'ISYERI', 'DEPO', 'OTOPARK', 'ORTAK_ALAN'] as const;

export class BolumOlusturDto {
  @ApiPropertyOptional({ description: 'Blok kimliği. Tek bloklu apartmanlarda boş bırakılır.' })
  @IsOptional() @IsUUID()
  blokId?: string;

  @ApiProperty({ example: '12' })
  @IsString() @Length(1, 16)
  kapiNo!: string;

  @ApiProperty({ example: 3, description: 'Bodrum katlar negatif olabilir.' })
  @IsInt() @Min(-10) @Max(200)
  kat!: number;

  @ApiProperty({ enum: BOLUM_NITELIKLERI, example: 'MESKEN' })
  @IsIn(BOLUM_NITELIKLERI)
  nitelik!: (typeof BOLUM_NITELIKLERI)[number];

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
}

export class BolumSilDto {
  @ApiProperty({
    example: 'Bölüm birleştirildi, kayıt mükerrer',
    description: 'Soft delete gerekçesi zorunludur (BFS v1 §5.2).',
  })
  @IsString() @MinLength(10, { message: 'Silme gerekçesi en az 10 karakter olmalıdır.' })
  gerekce!: string;
}
