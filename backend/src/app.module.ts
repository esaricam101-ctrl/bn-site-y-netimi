import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { ortamSemasi } from './config/env.schema';
import { kokOrtamDosyasi } from './config/kok';
import { PrismaModule } from './common/prisma/prisma.module';
import { IstekSiniriGuard } from './common/guards/istek-siniri.guard';
import { AuthGuard } from './common/guards/auth.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { PermissionGuard } from './common/guards/permission.guard';
import { AuditInterceptor } from './common/audit/audit.interceptor';
import { IdempotansInterceptor } from './common/idempotans/idempotans.interceptor';
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
import { TahakkukModule } from './modules/tahakkuk/tahakkuk.module';
import { VirmanModule } from './modules/virman/virman.module';
import { AracModule } from './modules/arac/arac.module';
import { SayacModule } from './modules/sayac/sayac.module';
import { StorageModule } from './common/storage/storage.module';
import { BelgeModule } from './modules/belge/belge.module';
import { MuhasebeModule } from './modules/muhasebe/muhasebe.module';
import { PortfoyModule } from './modules/portfoy/portfoy.module';
import { BankaModule } from './modules/banka/banka.module';
import { TahsilatModule } from './modules/tahsilat/tahsilat.module';
import { GeriAlmaModule } from './modules/geri-alma/geri-alma.module';
import { IletisimModule } from './modules/iletisim/iletisim.module';
import { SitePersoneliModule } from './modules/site-personeli/site-personeli.module';
import { DaireGorevlisiModule } from './modules/daire-gorevlisi/daire-gorevlisi.module';
import { MisafirModule } from './modules/misafir/misafir.module';
import { AuditSorguModule } from './modules/audit/audit-sorgu.module';

@Module({
  imports: [
    /*
     * ⚠️  `envFilePath` AÇIKÇA VERİLİR. Varsayılan davranış `.env`i çalışma
     *     dizininde arar; backend ise her zaman `backend/` içinden koşar
     *     (`nest start`, `vitest`) ve kökteki dosyayı HİÇ görmezdi.
     *     `pnpm dev:backend` bu yüzden "DATABASE_URL: Required" ile ölüyordu.
     *     Gerekçenin tamamı `config/kok.ts` başlığındadır.
     */
    ConfigModule.forRoot({
      isGlobal: true,
      validate: ortamSemasi,
      ...(kokOrtamDosyasi() === undefined ? {} : { envFilePath: kokOrtamDosyasi() }),
    }),
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
    // Tahakkuk: gideri bölümlere paylaştırıp borç yazar. GiderTuru'nden SONRA
    // gelir — kural olmadan tahakkuk çalıştırılamaz.
    TahakkukModule,
    VirmanModule,
    // Operasyonel varlıklar — dönemsel kayıtlar, silinmez.
    AracModule,
    // Sayaç: TUKETIM paylaşım kuralının girdisi. Tahakkuk buradan okur.
    SayacModule,
    // Belge: versiyonlanır, silinmez. Dosya nesne deposundadır.
    StorageModule,
    BelgeModule,
    // Daire görevlileri — sitede görev yapan personel. Malik/Kiracı/Sakin
    // modüllerinden AYRIDIR ve onlara dokunmaz.
    MuhasebeModule,
    BankaModule,
    TahsilatModule,
    GeriAlmaModule,
    // İletişim: WhatsApp · SMS · (ileride e-posta) TEK modülde. Kanal bir
    // ALANDIR; ayrı modüller alıcı çözümünü ve izin denetimini iki kez
    // yazdırırdı.
    IletisimModule,
    PortfoyModule,
    SitePersoneliModule,
    DaireGorevlisiModule,
    MisafirModule,
    // Denetim kaydı OKUMA ucu. Yazma tarafı common/audit içindedir.
    AuditSorguModule,
  ],
  providers: [
    /*
     * İSTEK SINIRI ÜÇ KAPIDAN ÖNCE gelir ve bir "kapı" DEĞİLDİR.
     *
     * Kapılar "bu kişi bunu yapabilir mi" sorusunu yanıtlar; sınır "bu kadar
     * sık yapılabilir mi" sorusunu. Sıra önemlidir: sınır en sonda olsaydı,
     * reddedilen istek yine de JWT doğrulaması ve veritabanı okuması yaptırırdı
     * — korumanın engellemeye çalıştığı maliyetin bir kısmı zaten ödenmiş
     * olurdu.
     *
     * Yalnızca `@IstekSiniri(...)` taşıyan uçlar etkilenir; ötekiler dokunmadan
     * geçer.
     */
    { provide: APP_GUARD, useClass: IstekSiniriGuard },
    // ÜÇ KAPI — sıra değişmez (ADR-0006 · BFS v1 §3).
    // NestJS global guard'ları kayıt sırasıyla çalıştırır.
    { provide: APP_GUARD, useClass: AuthGuard },        // Kapı 1 — Kimlik
    { provide: APP_GUARD, useClass: TenantGuard },      // Kapı 2 — Kiracı
    { provide: APP_GUARD, useClass: PermissionGuard },  // Kapı 3 — İzin
    // Idempotans, audit'ten ONCE: tekrar gelen istek is katmanina hic girmez.
    { provide: APP_INTERCEPTOR, useClass: IdempotansInterceptor },
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

