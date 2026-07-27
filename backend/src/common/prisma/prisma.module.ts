import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import { TenantOkuyucu } from './tenant.reader';
import { OnbellekServisi } from './cache.service';

@Global()
@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env['JWT_SECRET'] ?? 'gelistirme-icin-degistirin-en-az-32-karakter',
      signOptions: { expiresIn: process.env['JWT_ACCESS_TTL'] ?? '15m' },
    }),
  ],
  providers: [PrismaService, TenantOkuyucu, OnbellekServisi],
  exports: [PrismaService, TenantOkuyucu, OnbellekServisi, JwtModule],
})
export class PrismaModule {}
