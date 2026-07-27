import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Length, Max, Min, MinLength } from 'class-validator';

export class KatOlusturDto {
  @ApiProperty({ description: 'Katın bağlı olduğu blok.' })
  @IsUUID()
  blokId!: string;

  @ApiProperty({ example: 3, description: 'Bodrum katlar negatif olabilir (-1, -2).' })
  @IsInt() @Min(-10) @Max(200)
  no!: number;

  @ApiPropertyOptional({ example: 'Zemin', description: 'Görünen ad; boşsa numara kullanılır.' })
  @IsOptional() @IsString() @Length(1, 40)
  ad?: string;
}

export class KatSilDto {
  @ApiProperty({
    example: 'Kat numarası yanlış girilmiş',
    description: 'Soft delete gerekçesi zorunludur (BFS v1 §5.2).',
  })
  @IsString() @MinLength(10, { message: 'Silme gerekçesi en az 10 karakter olmalıdır.' })
  gerekce!: string;
}
