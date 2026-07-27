import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class GirisDto {
  @ApiProperty({ example: 'yonetici@guzel-apartmani.test' })
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi girin.' })
  eposta!: string;

  @ApiProperty({ example: 'bnos1234' })
  @IsString()
  @MinLength(8, { message: 'Şifre en az 8 karakter olmalıdır.' })
  sifre!: string;
}

export class YenilemeDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}
