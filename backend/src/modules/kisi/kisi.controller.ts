import { Body, Controller, DefaultValuePipe, Delete, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Principal } from '@bnos/kernel';
import { IZINLER } from '@bnos/core-domain';
import { AktifPrincipal, RequirePermission } from '../../common/decorators';
import { KisiCommandService } from './kisi.command.service';
import { KisiQueryService, type KisiSatiri, type SayfaliSonuc } from './kisi.query.service';
import { KisiOlusturDto, KisiSilDto } from './dto/kisi.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

@ApiTags('Kişi')
@ApiBearerAuth()
@Controller('kisiler')
export class KisiController {
  constructor(
    private readonly command: KisiCommandService,
    private readonly query: KisiQueryService,
  ) {}

  @Post()
  @RequirePermission(IZINLER.KISI_YONET)
  @ApiOperation({ summary: 'Kişi oluştur' })
  olustur(@Body() dto: KisiOlusturDto, @AktifPrincipal() principal: Principal): Promise<KomutSonucu> {
    return this.command.olustur(dto, principal);
  }

  @Get()
  @RequirePermission(IZINLER.KISI_GORUNTULE)
  @ApiOperation({ summary: 'Kişileri listele (cursor sayfalama)' })
  listele(
    @AktifPrincipal() principal: Principal,
    @Query('imlec') imlec?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
  ): Promise<SayfaliSonuc<KisiSatiri>> {
    return this.query.listele(principal, imlec, Math.min(limit, 200));
  }

  @Delete(':id')
  @RequirePermission(IZINLER.KISI_YONET)
  @ApiOperation({
    summary: 'Kişiyi soft-delete et',
    description:
      'Gerekçe zorunludur. Soft delete KVKK silme hakkını KARŞILAMAZ — ' +
      'veri sahibinin silme talebi ayrı bir anonimleştirme işlemidir (BFS v1 §5.3).',
  })
  sil(
    @Param('id') id: string,
    @Body() dto: KisiSilDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.command.softSil(id, dto.gerekce, principal);
  }
}
