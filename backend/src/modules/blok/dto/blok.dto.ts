import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Length, MinLength } from 'class-validator';

export class BlokOlusturDto {
  @ApiProperty({
    description: 'Bloğun bağlı olduğu apartman. Üst kayıt olmadan blok oluşturulamaz.',
  })
  @IsUUID()
  apartmanId!: string;

  @ApiProperty({
    example: 'A Blok',
    description: 'Blok adı APARTMAN içinde tekildir; sitede iki apartmanın da “A Blok”u olabilir.',
  })
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
