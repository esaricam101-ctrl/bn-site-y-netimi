import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IZINLER } from '@bnos/core-domain';
import { AktifPrincipal, RequirePermission } from '../../common/decorators';
import { Principal } from '@bnos/kernel';
import { TenantCommandService } from './tenant.command.service';
import { TenantQueryService } from './tenant.query.service';
import { TenantOlusturDto } from './dto/tenant.dto';

@ApiTags('Tenant')
// Cogul: diger tum kaynak denetleyicileri cogul (apartmanlar · bloklar ·
// bolumler · kisiler · katlar · daireler). Sozlesme testi de `/tenants`
// bekliyordu; tekil biciminden dolayi rota HIC ESLESMIYORDU ve yetkisiz
// istek 403 yerine 404 donuyordu — izin denetimi hic calismiyordu.
@Controller('tenants')
export class TenantController {
  constructor(
    private readonly command: TenantCommandService,
    private readonly query: TenantQueryService,
  ) {}

  // İZİN DENETİMİ — bu denetleyicide HİÇ YOKTU.
  //
  // Kimliği doğrulanmış HERHANGİ bir kullanıcı yeni tenant oluşturabiliyordu:
  // bir apartmanın sakini, kendi apartmanının verisine erişemese bile sisteme
  // yeni yerleşke açabilirdi. Kapı 3 (İzin) bu uçlarda hiç çalışmıyordu.
  //
  // Sözleşme testi bunu yakalamak için yazılmıştı ama hiç koşulmamıştı
  // (veritabanı yoktu) — üstelik rota adı da eşleşmediği için istek 404
  // dönüyor ve test kırmızı bile olsa yanlış nedeni gösteriyordu.

  @Post()
  @RequirePermission(IZINLER.TENANT_KURULUM)
  @ApiOperation({ summary: 'Apartman oluştur', description: 'Yeni apartman kaydı oluşturur.' })
  async olustur(@Body() dto: TenantOlusturDto, @AktifPrincipal() principal: Principal) {
    return this.command.olustur(dto, principal);
  }

  @Put(':id/aktiflestir')
  @RequirePermission(IZINLER.TENANT_KURULUM)
  @ApiOperation({ summary: 'Apartman aktifleştir', description: 'Kurulum durumundaki apartmanı aktifleştirir.' })
  async aktiflestir(@Param('id') id: string, @AktifPrincipal() principal: Principal) {
    return this.command.aktiflestir(id, principal);
  }

  @Get(':id')
  @RequirePermission(IZINLER.TENANT_GORUNTULE)
  @ApiOperation({ summary: 'Apartman özetini getir', description: 'Apartmana ait özet bilgileri döndürür.' })
  async ozet(@Param('id') id: string, @AktifPrincipal() principal: Principal) {
    return this.query.ozet(id, principal);
  }
}
