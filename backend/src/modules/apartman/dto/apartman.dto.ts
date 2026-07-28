import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MinLength } from 'class-validator';

export class ApartmanOlusturDto {
  @ApiProperty({ example: 'Güzel Apartmanı' })
  @IsString() @Length(2, 120)
  ad!: string;

  @ApiPropertyOptional({ example: 'Bağdat Cad. No:12, Kadıköy/İstanbul' })
  @IsOptional() @IsString() @Length(1, 500)
  adres?: string;

  @ApiPropertyOptional({
    example: 'A',
    description: 'Site içindeki kısa kod. Site dışı tenant’ta boş bırakılır.',
  })
  @IsOptional() @IsString() @Length(1, 16)
  siteIciKod?: string;
}

/** Tüm alanlar isteğe bağlıdır; yalnızca verilenler güncellenir. */
export class ApartmanGuncelleDto {
  @ApiPropertyOptional({ example: 'Güzel Apartmanı' })
  @IsOptional() @IsString() @Length(2, 120)
  ad?: string;

  @ApiPropertyOptional({ example: 'Bağdat Cad. No:12, Kadıköy/İstanbul' })
  @IsOptional() @IsString() @Length(1, 500)
  adres?: string;

  @ApiPropertyOptional({ example: 'A' })
  @IsOptional() @IsString() @Length(1, 16)
  siteIciKod?: string;
}

export class ApartmanSilDto {
  @ApiProperty({
    example: 'Apartman kaydı mükerrer girilmiş',
    description: 'Soft delete gerekçesi zorunludur (BFS v1 §5.2).',
  })
  @IsString() @MinLength(10, { message: 'Silme gerekçesi en az 10 karakter olmalıdır.' })
  gerekce!: string;
}
