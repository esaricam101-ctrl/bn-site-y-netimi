import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Principal } from '@bnos/kernel';
import { IZINLER } from '@bnos/core-domain';
import { AktifPrincipal, RequirePermission } from '../../common/decorators';
import { KiraciCommandService } from './kiraci.command.service';
import { KiraciQueryService, type KiraciSatiri } from './kiraci.query.service';
import { KiraciEkleDto, KiraciTahliyeDto } from './dto/kiraci.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

@ApiTags('Kiracı')
@ApiBearerAuth()
@Controller('bolumler/:bolumId/kiracilar')
export class KiraciController {
  constructor(
    private readonly command: KiraciCommandService,
    private readonly query: KiraciQueryService,
  ) {}

  @Post()
  @RequirePermission(IZINLER.BOLUM_YONET)
  @ApiOperation({
    summary: 'Bölüme kira sözleşmesi bağla',
    description:
      'Kiracı, SAKİN ile aynı şey değildir: şirket kiracı olup hiç oturmayabilir. ' +
      'Bir bölümde aynı anda en fazla bir kiracı bulunur.',
  })
  ekle(
    @Param('bolumId') bolumId: string,
    @Body() dto: KiraciEkleDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.command.ekle(bolumId, dto, principal);
  }

  @Get()
  @RequirePermission(IZINLER.BOLUM_GORUNTULE)
  @ApiQuery({
    name: 'tarih', required: false,
    description: 'Verilirse o gün geçerli sözleşme; verilmezse TÜM kira tarihçesi.',
  })
  @ApiOperation({
    summary: 'Bölümün kira geçmişi',
    description: 'Tahliye edilmiş sözleşmeler silinmez; `gecerliMi: false` ile döner.',
  })
  listele(
    @Param('bolumId') bolumId: string,
    @AktifPrincipal() principal: Principal,
    @Query('tarih') tarih?: string,
  ): Promise<readonly KiraciSatiri[]> {
    return this.query.listele(bolumId, principal, tarih);
  }

  @Patch(':kiraciId/tahliye')
  @RequirePermission(IZINLER.BOLUM_YONET)
  @ApiOperation({
    summary: 'Kiracıyı tahliye et',
    description:
      'Sözleşme kapanır, kayıt SİLİNMEZ. Tahliye tarihi aynı zamanda sözleşme ' +
      'bitişidir; aksi hâlde ilişki süresiz görünür ve yeni kiracı eklenemez.',
  })
  tahliyeEt(
    @Param('bolumId') bolumId: string,
    @Param('kiraciId') kiraciId: string,
    @Body() dto: KiraciTahliyeDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.command.tahliyeEt(bolumId, kiraciId, dto, principal);
  }
}
