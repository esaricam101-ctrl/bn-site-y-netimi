import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, MinLength } from 'class-validator';

export class KisiOlusturDto {
  @ApiProperty({ example: 'Ayşe' })
  @IsString() @Length(2, 60)
  ad!: string;

  @ApiProperty({ example: 'Yılmaz' })
  @IsString() @Length(2, 60)
  soyad!: string;

  @ApiPropertyOptional({ example: 'ayse@ornek.com' })
  @IsOptional() @IsEmail()
  eposta?: string;

  @ApiPropertyOptional({ example: '+905321234567' })
  @IsOptional() @IsString()
  telefon?: string;
}

export class KisiSilDto {
  @ApiProperty({
    example: 'Malik taşındı, kayıt mükerrer',
    description: 'Soft delete gerekçesi zorunludur (BFS v1 §5.2).',
  })
  @IsString() @MinLength(10, { message: 'Silme gerekçesi en az 10 karakter olmalıdır.' })
  gerekce!: string;
}
