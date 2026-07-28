import { Body, Controller, DefaultValuePipe, Delete, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Principal } from '@bnos/kernel';
import { IZINLER } from '@bnos/core-domain';
import { AktifPrincipal, RequirePermission } from '../../common/decorators';
import { KisiCommandService } from './kisi.command.service';
import {
  KisiQueryService,
  type KisiIliskiOzeti, type KisiSatiri, type SayfaliSonuc,
} from './kisi.query.service';
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
    const temizLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50;
    return this.query.listele(principal, imlec, temizLimit);
  }

  @Get(':id/bolumler')
  @RequirePermission(IZINLER.BOLUM_GORUNTULE)
  @ApiOperation({
    summary: 'Kişinin tüm bölüm ilişkileri (malik · kiracı · sakin)',
    description:
      'Daire kartının TERSİ görünüm: “bu kişi nerelerde kayıtlı?”. Bir kişi ' +
      'taşındığında ya da KVKK talebi geldiğinde hangi kayıtların etkilendiğini ' +
      'görmek için gerekir.\n\n' +
      'Aynı kişi aynı bölümde üç rolde birden bulunabilir — oturan malik hem ' +
      'MALIK hem SAKIN kaydı taşır. Roller AYRI satırlar olarak döner.',
  })
  bolumIliskileri(
    @Param('id') id: string,
    @AktifPrincipal() principal: Principal,
  ): Promise<KisiIliskiOzeti> {
    return this.query.bolumIliskileri(id, principal);
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
