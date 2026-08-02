import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Principal } from '@bnos/kernel';
import { IZINLER } from '@bnos/core-domain';
import { AktifPrincipal, RequirePermission } from '../../common/decorators';
import { VirmanCommandServisi, type VirmanSonucu } from './virman.command.service';
import { VirmanEkleDto } from './dto/virman.dto';

@ApiTags('Virman')
@ApiBearerAuth()
@Controller('virman')
export class VirmanController {
  constructor(private readonly komut: VirmanCommandServisi) {}

  @Post()
  /*
   * ⚠️  `FINANS_YEVMIYE_GIRIS`. Virman deftere yazabilen bir işlemdir; okuma
   *     izni yetmez. DENETCI rolü bu izni taşımaz ve taşımamalıdır: denetim
   *     denetlediği kaydı üretemez.
   */
  @RequirePermission(IZINLER.FINANS_YEVMIYE_GIRIS)
  @ApiOperation({
    summary: 'Virman — borcu doğru kişiye aktar (ADR-0016)',
    description:
      'TANIM: virman mevcut borcu İPTAL ETMEK için değil, DOĞRU KİŞİYE ' +
      'AKTARMAK için yapılan muhasebe işlemidir. Toplam borç DEĞİŞMEZ; ' +
      'değişen yalnızca borcun muhatabıdır.\n\n' +
      '**İKİ DAVRANIŞ:**\n' +
      '- `satirlar` DOLU → deftere fiş yazılır (bakiye taşıyan virman)\n' +
      '- `satirlar` BOŞ → fiş YAZILMAZ (taşınma virmanı)\n\n' +
      'Taşınmada borcun toplamı da hangi hesapta durduğu da değişmez; ' +
      'yalnızca yardımcı defterin içindeki dağılım değişir. Deftere ' +
      'yazılacak DENK bir kayıt yoktur.\n\n' +
      'İKİ TARAF AYNI TRANSACTION\'DA: fiş ve cari payları birlikte yazılır. ' +
      'Biri yazılıp öteki yazılmazsa defter ile cari kalıcı olarak ayrışır.',
  })
  ekle(
    @Body() dto: VirmanEkleDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<VirmanSonucu> {
    return this.komut.ekle(dto, principal);
  }
}
