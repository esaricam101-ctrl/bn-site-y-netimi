import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { ortamSemasi } from './config/env.schema';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthGuard } from './common/guards/auth.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { PermissionGuard } from './common/guards/permission.guard';
import { AuditInterceptor } from './common/audit/audit.interceptor';
import { AuditModule } from './common/audit/audit.module';
import { CorrelationMiddleware } from './common/context/correlation.middleware';
import { OutboxModule } from './common/outbox/outbox.module';
import { NumberingModule } from './common/numbering/numbering.module';
import { HealthModule } from './modules/health/health.module';
import { OturumModule } from './modules/oturum/oturum.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { KisiModule } from './modules/kisi/kisi.module';
import { BolumModule } from './modules/bolum/bolum.module';
import { IliskiModule } from './modules/iliski/iliski.module';
import { BlokModule } from './modules/blok/blok.module';
import { ApartmanModule } from './modules/apartman/apartman.module';
import { KatModule } from './modules/kat/kat.module';
import { MalikModule } from './modules/malik/malik.module';
import { KiraciModule } from './modules/kiraci/kiraci.module';
import { SakinModule } from './modules/sakin/sakin.module';
import { DaireModule } from './modules/daire/daire.module';
import { GiderTuruModule } from './modules/gider-turu/gider-turu.module';
import { AuditSorguModule } from './modules/audit/audit-sorgu.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: ortamSemasi }),
    PrismaModule,
    AuditModule,
    OutboxModule,
    NumberingModule,
    HealthModule,
    OturumModule,
    TenantModule,
    KisiModule,
    // Hiyerarşi sırası (ADR-0008): Apartman → Blok → Kat → BagimsizBolum
    ApartmanModule,
    BlokModule,
    KatModule,
    BolumModule,
    // Bölüme bağlı kişi ilişkileri: malik (hisseli) · kiracı (sözleşmeli) ·
    // sakin (fiilen oturan). Üçü AYRI kavramdır.
    MalikModule,
    KiraciModule,
    SakinModule,
    // Okuma modeli: yukarıdakileri tek daire kartında birleştirir.
    DaireModule,
    IliskiModule,
    // Aidat kuralları — VERİ olarak (KMK md. 20). Tahakkuk bu katalogdan okur.
    GiderTuruModule,
    // Denetim kaydı OKUMA ucu. Yazma tarafı common/audit içindedir.
    AuditSorguModule,
  ],
  providers: [
    // ÜÇ KAPI — sıra değişmez (ADR-0006 · BFS v1 §3).
    // NestJS global guard'ları kayıt sırasıyla çalıştırır.
    { provide: APP_GUARD, useClass: AuthGuard },        // Kapı 1 — Kimlik
    { provide: APP_GUARD, useClass: TenantGuard },      // Kapı 2 — Kiracı
    { provide: APP_GUARD, useClass: PermissionGuard },  // Kapı 3 — İzin
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule implements NestModule {
  /**
   * İstek bağlamı MIDDLEWARE ile kurulur, interceptor ile DEĞİL.
   *
   * NestJS sırası: middleware → guard → interceptor → handler. Bağlam bir
   * interceptor'da kurulsaydı guard'lar (Üç Kapı) ondan önce çalışır ve
   * principal/tenant bilgisini bağlama YAZAMAZDI — nitekim yazamıyordu.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
