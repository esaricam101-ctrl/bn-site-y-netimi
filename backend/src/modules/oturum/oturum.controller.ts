import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators';
import { OturumServisi, type GirisYaniti } from './oturum.service';
import { GirisDto, YenilemeDto } from './dto/oturum.dto';

@ApiTags('Oturum')
@Controller('oturum')
export class OturumController {
  constructor(private readonly oturum: OturumServisi) {}

  @Post('giris')
  @Public('Giriş ucudur; kimlik burada kurulur. Üç kapıdan önce gelir.')
  @ApiOperation({
    summary: 'Giriş yap',
    description:
      'Tek giriş ekranı. Yanıttaki varsayilanPanel, kullanıcının en geniş yetkili ' +
      'rolüne göre belirlenir (ADR v1.1 §10).',
  })
  giris(@Body() dto: GirisDto): Promise<GirisYaniti> {
    return this.oturum.giris(dto);
  }

  @Post('yenile')
  @Public('Yenileme belirteci kendi kimliğini taşır.')
  @ApiOperation({
    summary: 'Erişim belirtecini yenile',
    description: 'İzinler veritabanından tazelenir; eski belirteçten kopyalanmaz.',
  })
  yenile(@Body() dto: YenilemeDto): Promise<{ accessToken: string }> {
    return this.oturum.yenile(dto.refreshToken);
  }
}
