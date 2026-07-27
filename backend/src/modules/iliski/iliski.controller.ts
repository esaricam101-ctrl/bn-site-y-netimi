import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Principal } from '@bnos/kernel';
import { IZINLER } from '@bnos/core-domain';
import { AktifPrincipal, RequirePermission } from '../../common/decorators';
import { IliskiCommandService } from './iliski.command.service';
import { IliskiQueryService, type IliskiSatiri } from './iliski.query.service';
import { IliskiKurDto, IliskiSonlandirDto } from './dto/iliski.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

@ApiTags('Bölüm İlişkisi')
@ApiBearerAuth()
@Controller('bolumler/:bolumId/iliskiler')
export class IliskiController {
  constructor(
    private readonly command: IliskiCommandService,
    private readonly query: IliskiQueryService,
  ) {}

  @Post()
  @RequirePermission(IZINLER.BOLUM_YONET)
  @ApiOperation({
    summary: 'Bölüme malik veya kiracı bağla',
    description:
      'Bir bölümde aynı anda en fazla bir malik ve en fazla bir kiracı bulunur. ' +
      'Aynı roldeki tarih aralıkları çakışamaz — çakışırsa borç sorumluluğu ' +
      'çözümlemesi yanlış kişiyi seçer (ADR v1.1 §5).',
  })
  kur(
    @Param('bolumId') bolumId: string,
    @Body() dto: IliskiKurDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.command.kur(bolumId, dto, principal);
  }

  @Get()
  @RequirePermission(IZINLER.BOLUM_GORUNTULE)
  @ApiOperation({
    summary: 'Bölümün malik ve kiracı geçmişi',
    description:
      '`tarih` verilirse yalnızca o takvim gününde geçerli ilişkiler döner — ' +
      'geçmiş bir tahakkukun kime yazıldığını denetlemenin yoludur.',
  })
  listele(
    @Param('bolumId') bolumId: string,
    @AktifPrincipal() principal: Principal,
    @Query('tarih') tarih?: string,
  ): Promise<readonly IliskiSatiri[]> {
    return this.query.listele(bolumId, principal, tarih);
  }

  @Patch(':iliskiId/sonlandir')
  @RequirePermission(IZINLER.BOLUM_YONET)
  @ApiOperation({
    summary: 'İlişkiyi sonlandır',
    description:
      'Kayıt SİLİNMEZ, bitiş tarihi alır. Borç sorumluluğu borcun oluştuğu anda ' +
      'çözülüp yazılır; geçmiş ilişkiyi silmek o kaydın dayanağını yok eder.',
  })
  sonlandir(
    @Param('bolumId') bolumId: string,
    @Param('iliskiId') iliskiId: string,
    @Body() dto: IliskiSonlandirDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.command.sonlandir(bolumId, iliskiId, dto.bitis, principal);
  }
}
