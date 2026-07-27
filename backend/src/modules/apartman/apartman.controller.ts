import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Principal } from '@bnos/kernel';
import { IZINLER } from '@bnos/core-domain';
import { AktifPrincipal, RequirePermission } from '../../common/decorators';
import { ApartmanCommandService } from './apartman.command.service';
import { ApartmanQueryService, type ApartmanSatiri } from './apartman.query.service';
import { ApartmanOlusturDto, ApartmanSilDto } from './dto/apartman.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

@ApiTags('Apartman')
@ApiBearerAuth()
@Controller('apartmanlar')
export class ApartmanController {
  constructor(
    private readonly command: ApartmanCommandService,
    private readonly query: ApartmanQueryService,
  ) {}

  @Post()
  @RequirePermission(IZINLER.BOLUM_YONET)
  @ApiOperation({
    summary: 'Apartman oluştur',
    description:
      'Hiyerarşinin tenant altındaki ilk katmanı (ADR-0008). Blok bir apartmana ' +
      'bağlı olmak zorundadır; üst kayıt olmadan alt kayıt oluşturulamaz.',
  })
  olustur(
    @Body() dto: ApartmanOlusturDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.command.olustur(dto, principal);
  }

  @Get()
  @RequirePermission(IZINLER.BOLUM_GORUNTULE)
  @ApiOperation({ summary: 'Apartmanları listele (blok sayısıyla)' })
  listele(@AktifPrincipal() principal: Principal): Promise<readonly ApartmanSatiri[]> {
    return this.query.listele(principal);
  }

  @Delete(':id')
  @RequirePermission(IZINLER.BOLUM_YONET)
  @ApiOperation({
    summary: 'Apartmanı soft-delete et',
    description: 'Gerekçe zorunludur. Bloğu olan apartman silinemez.',
  })
  sil(
    @Param('id') id: string,
    @Body() dto: ApartmanSilDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.command.softSil(id, dto.gerekce, principal);
  }
}
