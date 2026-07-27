import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { APARTMAN_MANIFEST, SOZLESME_TESTLERI } from '@bnos/module-sdk';
import { Public } from '../../common/decorators';
import { PrismaService } from '../../common/prisma/prisma.service';

@ApiTags('Sistem')
@Controller('saglik')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Public('Yük dengeleyici ve konteyner sağlık kontrolü — kimlik gerektirmez.')
  @ApiOperation({ summary: 'Sağlık kontrolü' })
  async saglik(): Promise<{ durum: string; veritabani: string; surum: string }> {
    let veritabani = 'kapalı';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      veritabani = 'açık';
    } catch { /* durum kapalı kalır */ }
    return { durum: veritabani === 'açık' ? 'saglikli' : 'bozuk', veritabani, surum: APARTMAN_MANIFEST.surum };
  }

  @Get('manifest')
  @Public('Modül manifestosu — BNOS modül kayıt defteri tarafından okunur.')
  @ApiOperation({ summary: 'Modül manifestosu (ADR v1.1 §40)' })
  manifest(): typeof APARTMAN_MANIFEST {
    return APARTMAN_MANIFEST;
  }

  @Get('sozlesme-testleri')
  @Public('Sözleşme testi kataloğu — denetim şeffaflığı.')
  @ApiOperation({ summary: 'Sözleşme testi kataloğu (BFS v1 §14.1)' })
  sozlesmeTestleri(): typeof SOZLESME_TESTLERI {
    return SOZLESME_TESTLERI;
  }
}
