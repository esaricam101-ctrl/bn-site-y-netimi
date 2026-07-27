import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Principal } from '@bnos/kernel';
import { TenantCommandService } from './tenant.command.service';
import { TenantQueryService } from './tenant.query.service';
import { TenantOlusturDto } from './dto/tenant.dto';

@ApiTags('Tenant')
@Controller('tenant')
export class TenantController {
  constructor(
    private readonly command: TenantCommandService,
    private readonly query: TenantQueryService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Apartman oluştur', description: 'Yeni apartman kaydı oluşturur.' })
  async olustur(@Body() dto: TenantOlusturDto, @CurrentUser() principal: Principal) {
    return this.command.olustur(dto, principal);
  }

  @Put(':id/aktiflestir')
  @ApiOperation({ summary: 'Apartman aktifleştir', description: 'Kurulum durumundaki apartmanı aktifleştirir.' })
  async aktiflestir(@Param('id') id: string, @CurrentUser() principal: Principal) {
    return this.command.aktiflestir(id, principal);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Apartman özetini getir', description: 'Apartmana ait özet bilgileri döndürür.' })
  async ozet(@Param('id') id: string, @CurrentUser() principal: Principal) {
    return this.query.ozet(id, principal);
  }
}
