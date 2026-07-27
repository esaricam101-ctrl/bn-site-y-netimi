import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { ortamSemasi } from './config/env.schema';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthGuard } from './common/guards/auth.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { PermissionGuard } from './common/guards/permission.guard';
import { AuditInterceptor } from './common/audit/audit.interceptor';
import { AuditModule } from './common/audit/audit.module';
import { CorrelationInterceptor } from './common/context/correlation.interceptor';
import { OutboxModule } from './common/outbox/outbox.module';
import { NumberingModule } from './common/numbering/numbering.module';
import { HealthModule } from './modules/health/health.module';
import { OturumModule } from './modules/oturum/oturum.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { KisiModule } from './modules/kisi/kisi.module';
import { BolumModule } from './modules/bolum/bolum.module';
import { IliskiModule } from './modules/iliski/iliski.module';
import { BlokModule } from './modules/blok/blok.module';

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
    BolumModule,
    IliskiModule,
    BlokModule,
  ],
  providers: [
    // ÜÇ KAPI — sıra değişmez (ADR-0006 · BFS v1 §3).
    // NestJS global guard'ları kayıt sırasıyla çalıştırır.
    { provide: APP_GUARD, useClass: AuthGuard },        // Kapı 1 — Kimlik
    { provide: APP_GUARD, useClass: TenantGuard },      // Kapı 2 — Kiracı
    { provide: APP_GUARD, useClass: PermissionGuard },  // Kapı 3 — İzin
    { provide: APP_INTERCEPTOR, useClass: CorrelationInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
