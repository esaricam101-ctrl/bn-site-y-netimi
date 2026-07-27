import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, MinLength } from 'class-validator';

export class BlokOlusturDto {
  @ApiProperty({ example: 'A Blok' })
  @IsString() @Length(1, 40)
  ad!: string;
}

export class BlokSilDto {
  @ApiProperty({
    example: 'Blok yanlış kaydedildi, mükerrer',
    description: 'Soft delete gerekçesi zorunludur (BFS v1 §5.2).',
  })
  @IsString() @MinLength(10, { message: 'Silme gerekçesi en az 10 karakter olmalıdır.' })
  gerekce!: string;
}
