import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Principal } from '@bnos/kernel';
import { IZINLER } from '@bnos/core-domain';
import { AktifPrincipal, RequirePermission } from '../../common/decorators';
import { AuditQueryService, type AuditSayfasi } from './audit.query.service';

@ApiTags('Denetim')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly query: AuditQueryService) {}

  @Get()
  @RequirePermission(IZINLER.AUDIT_GORUNTULE)
  @ApiQuery({ name: 'varlik', required: false, example: 'BagimsizBolum' })
  @ApiQuery({ name: 'varlikId', required: false })
  @ApiQuery({ name: 'eylem', required: false, example: 'GUNCELLE' })
  @ApiQuery({ name: 'imlec', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOperation({
    summary: 'Denetim kayıtları (kim · ne zaman · ne yaptı)',
    description:
      '`varlik` + `varlikId` birlikte verildiğinde tek bir kaydın tarihçesi döner.\n\n' +
      'Kayıtlar DEĞİŞTİRİLEMEZ; yalnızca okuma ucu vardır. Hash zinciri kaydın ' +
      'sonradan değiştirilmediğini kanıtlar — bir düzeltme ucu o kanıtı ' +
      'anlamsız kılardı (BFS v1 §13).',
  })
  listele(
    @AktifPrincipal() principal: Principal,
    @Query('varlik') varlik?: string,
    @Query('varlikId') varlikId?: string,
    @Query('eylem') eylem?: string,
    @Query('imlec') imlec?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
  ): Promise<AuditSayfasi> {
    const temizLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50;
    return this.query.listele(
      principal,
      {
        ...(varlik ? { varlik } : {}),
        ...(varlikId ? { varlikId } : {}),
        ...(eylem ? { eylem } : {}),
      },
      imlec,
      temizLimit,
    );
  }
}
