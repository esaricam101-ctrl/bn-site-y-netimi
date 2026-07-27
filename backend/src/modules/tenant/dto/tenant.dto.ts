import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class TenantOlusturDto {
  @ApiProperty({ example: 'guzel-apartmani', description: 'Benzersiz apartman kodu' })
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{2,31}$/, {
    message: 'Kod 3-32 karakter olmalı; küçük harf, rakam ve tire içerebilir.',
  })
  kod!: string;

  @ApiProperty({ example: 'Güzel Apartmanı' })
  @IsString()
  @Length(3, 120)
  ad!: string;

  @ApiPropertyOptional({ example: 'Europe/Istanbul', default: 'Europe/Istanbul' })
  @IsOptional() @IsString()
  saatDilimi?: string;

  @ApiPropertyOptional({ example: 'BNOS-APT-V1' })
  @IsOptional() @IsString()
  lisansKodu?: string;
}
