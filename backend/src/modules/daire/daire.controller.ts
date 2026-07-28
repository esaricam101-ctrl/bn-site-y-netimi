import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Principal } from '@bnos/kernel';
import { IZINLER } from '@bnos/core-domain';
import { AktifPrincipal, RequirePermission } from '../../common/decorators';
import { DaireQueryService, type DaireKarti } from './daire.query.service';

@ApiTags('Daire')
@ApiBearerAuth()
@Controller('daireler')
export class DaireController {
  constructor(private readonly query: DaireQueryService) {}

  @Get(':bolumId/kart')
  @RequirePermission(IZINLER.BOLUM_GORUNTULE)
  @ApiQuery({
    name: 'tarih', required: false,
    description:
      'Verilirse o güne ait anlık görüntü; verilmezse TÜM tarihçe (geçmiş malik, ' +
      'tahliye edilmiş kiracı ve çıkmış sakinler dâhil).',
  })
  @ApiOperation({
    summary: 'Daire kartı — malik · hisse · kiracı · sakin tek çağrıda',
    description:
      'Bir daire kartını çizmek için malik listesi, hisse durumu, kira sözleşmesi ' +
      've sakin listesi BİRLİKTE gerekir. Dört ayrı istek, ekranın dört ayrı anlık ' +
      'görüntüyü birleştirmesi demektir; `tarih` süzgeci verildiğinde bunların ' +
      'tutarsız olması mümkündür.\n\n' +
      '“Daire”, nitelik=MESKEN olan bir bağımsız bölümdür; ayrı bir hiyerarşi ' +
      'seviyesi değildir (KMK’da bağımsız bölüm zaten dairedir).',
  })
  kart(
    @Param('bolumId') bolumId: string,
    @AktifPrincipal() principal: Principal,
    @Query('tarih') tarih?: string,
  ): Promise<DaireKarti> {
    return this.query.kart(bolumId, principal, tarih);
  }
}
