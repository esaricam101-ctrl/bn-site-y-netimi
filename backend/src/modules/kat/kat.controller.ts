import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Principal } from '@bnos/kernel';
import { IZINLER } from '@bnos/core-domain';
import { AktifPrincipal, RequirePermission } from '../../common/decorators';
import { KatCommandService } from './kat.command.service';
import { KatQueryService, type KatSatiri } from './kat.query.service';
import { KatOlusturDto, KatSilDto } from './dto/kat.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

@ApiTags('Kat')
@ApiBearerAuth()
@Controller('katlar')
export class KatController {
  constructor(
    private readonly command: KatCommandService,
    private readonly query: KatQueryService,
  ) {}

  @Post()
  @RequirePermission(IZINLER.BOLUM_YONET)
  @ApiOperation({
    summary: 'Kat oluştur',
    description: 'Kat bir bloğa bağlıdır; blok olmadan kat oluşturulamaz.',
  })
  olustur(
    @Body() dto: KatOlusturDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.command.olustur(dto, principal);
  }

  @Get()
  @RequirePermission(IZINLER.BOLUM_GORUNTULE)
  @ApiQuery({ name: 'blokId', required: true })
  @ApiOperation({ summary: 'Bloğun katlarını listele (bölüm sayısıyla)' })
  listele(
    @Query('blokId') blokId: string,
    @AktifPrincipal() principal: Principal,
  ): Promise<readonly KatSatiri[]> {
    return this.query.listele(blokId, principal);
  }

  @Delete(':id')
  @RequirePermission(IZINLER.BOLUM_YONET)
  @ApiOperation({
    summary: 'Katı soft-delete et',
    description: 'Gerekçe zorunludur. Bağımsız bölümü olan kat silinemez.',
  })
  sil(
    @Param('id') id: string,
    @Body() dto: KatSilDto,
    @AktifPrincipal() principal: Principal,
  ): Promise<KomutSonucu> {
    return this.command.softSil(id, dto.gerekce, principal);
  }
}
