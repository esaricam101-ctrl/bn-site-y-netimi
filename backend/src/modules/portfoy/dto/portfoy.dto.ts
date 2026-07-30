import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional, IsString, IsUUID, Length, MinLength } from 'class-validator';

export class DevirEkleDto {
  @ApiProperty({ description: 'Yönetimi devralınacak proje tenant kimliği.' })
  @IsUUID()
  projeTenantId!: string;

  @ApiProperty({
    example: 'Yönetim sözleşmesi 2026/14 — 12.01.2026 tarihli genel kurul kararı',
    description:
      'Devrin dayanağı ZORUNLUDUR: dayanağı olmayan bir devir, hangi kararla ' +
      'verildiği sorulduğunda cevapsız kalır (KMK md. 34 · yönetici seçimi).',
  })
  @IsString() @Length(3, 200)
  dayanak!: string;

  @ApiProperty({ example: '2026-01-15' })
  @IsDateString({}, { message: 'Devir başlangıcı YYYY-MM-DD biçiminde olmalıdır.' })
  baslangic!: string;

  @ApiPropertyOptional({
    example: '2027-01-14',
    description: 'Boş bırakılırsa devir SÜRESİZDİR (sözleşme yenilendikçe sürer).',
  })
  @IsOptional() @IsDateString()
  bitis?: string;
}

export class DevirSonlandirDto {
  @ApiProperty({
    example: 'Yönetim sözleşmesi yenilenmedi; 2027/3 sayılı genel kurul kararı',
    description:
      'Yetkinin ne zaman ve neden kalktığı, sonradan "bu firma o tarihte neden ' +
      'erişemedi?" sorusunun cevabıdır.',
  })
  @IsString() @MinLength(5, { message: 'Gerekçe en az 5 karakter olmalıdır.' })
  gerekce!: string;

  @ApiPropertyOptional({
    example: '2027-01-14',
    description: 'Boş bırakılırsa bugün kapatılır.',
  })
  @IsOptional() @IsDateString()
  bitis?: string;

  @ApiPropertyOptional({
    description:
      'true ise devir İPTAL sayılır (hiç geçerli olmamış gibi işaretlenir); ' +
      'false/boş ise normal biçimde SONA ERDİ. Ayrım denetimde görünür.',
  })
  @IsOptional() @IsBoolean()
  iptalMi?: boolean;
}
