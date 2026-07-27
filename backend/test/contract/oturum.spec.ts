/**
 * CT-04 · Her korumalı endpoint üç kapıdan geçer
 * Kaynak: ADR-0006 · BFS v1 §3
 *
 * PostgreSQL gerektirir: `pnpm db:up && pnpm db:migrate && pnpm db:seed`
 */
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module';
import { ProblemDetailsFilter } from '../../src/common/errors/problem-details.filter';
import { CorrelationInterceptor } from '../../src/common/context/correlation.interceptor';

describe('CT-04 · Üç kapı', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const modul = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modul.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new ProblemDetailsFilter());
    app.useGlobalInterceptors(new CorrelationInterceptor());
    await app.init();

    const giris = await request(app.getHttpServer())
      .post('/api/v1/oturum/giris')
      .send({ eposta: 'yonetici@guzel-apartmani.test', sifre: 'bnos1234' });
    token = giris.body.accessToken;
  });

  afterAll(() => app.close());

  it('belirteçsiz istek 401 döner', async () => {
    const y = await request(app.getHttpServer()).get('/api/v1/kisiler');
    expect(y.status).toBe(401);
  });

  it('sağlık ucu kimlik gerektirmez (@Public)', async () => {
    const y = await request(app.getHttpServer()).get('/api/v1/saglik');
    expect(y.status).toBe(200);
  });

  it('geçerli belirteçle erişim sağlanır', async () => {
    const y = await request(app.getHttpServer())
      .get('/api/v1/kisiler')
      .set('Authorization', `Bearer ${token}`);
    expect(y.status).toBe(200);
  });

  it('yetkisiz işlem 403 döner ve GEREKEN İZNİ ADIYLA söyler', async () => {
    const y = await request(app.getHttpServer())
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({ kod: 'yeni-apartman', ad: 'Yeni Apartman' });
    // Apartman Yöneticisi rolünde tenant.setup izni YOKTUR.
    expect(y.status).toBe(403);
    expect(y.body.gerekenIzinler).toContain('tenant.setup');
  });

  it('hata yanıtı RFC 7807 biçimindedir ve korelasyon kimliği taşır', async () => {
    const y = await request(app.getHttpServer()).get('/api/v1/kisiler');
    expect(y.headers['content-type']).toContain('application/problem+json');
    expect(y.body).toHaveProperty('correlationId');
    expect(y.body).toHaveProperty('sonrakiEylem');
  });

  it('hatalı e-posta ile hatalı şifre AYIRT EDİLMEZ', async () => {
    const a = await request(app.getHttpServer())
      .post('/api/v1/oturum/giris')
      .send({ eposta: 'olmayan@ornek.test', sifre: 'bnos1234' });
    const b = await request(app.getHttpServer())
      .post('/api/v1/oturum/giris')
      .send({ eposta: 'yonetici@guzel-apartmani.test', sifre: 'yanlis-sifre' });

    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    // Kullanıcı sayımını (enumeration) önler.
    expect(a.body.detail).toBe(b.body.detail);
  });

  it('giriş rolüne uygun panele yönlendirir', async () => {
    const y = await request(app.getHttpServer())
      .post('/api/v1/oturum/giris')
      .send({ eposta: 'yonetici@guzel-apartmani.test', sifre: 'bnos1234' });
    expect(y.body.varsayilanPanel).toBe('/yonetim');
  });
});
