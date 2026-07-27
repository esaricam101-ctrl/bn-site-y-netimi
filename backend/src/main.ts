/**
 * BNOS Apartman Yönetimi — API giriş noktası
 *
 * Üç kapı (ADR-0006) global guard zinciri olarak kurulur; endpoint başına
 * elle eklenmez. Sıra değişmez: Kimlik → Kiracı → İzin.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ProblemDetailsFilter } from './common/errors/problem-details.filter';
import { CorrelationInterceptor } from './common/context/correlation.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = new Logger('Bootstrap');

  const prefix = process.env['API_PREFIX'] ?? '/api/v1';
  app.setGlobalPrefix(prefix.replace(/^\//, ''));

  app.use(helmet());
  app.enableCors({
    origin: process.env['WEB_ORIGIN'] ?? 'http://localhost:3000',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  // RFC 7807 — her hata korelasyon kimliği ve tek net sonraki eylem taşır (BFS v1 §12)
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.useGlobalInterceptors(new CorrelationInterceptor());

  const swagger = new DocumentBuilder()
    .setTitle('BNOS Apartman Yönetimi API')
    .setDescription(
      'Çok kiracılı apartman yönetim platformu. ' +
        'Tenant izolasyonu PostgreSQL RLS ile veritabanı düzeyinde zorlanır (ADR-0002).',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(`${prefix.replace(/^\//, '')}/docs`, app, SwaggerModule.createDocument(app, swagger));

  const port = Number(process.env['API_PORT'] ?? 3001);
  await app.listen(port);
  logger.log(`BNOS Apartman API çalışıyor: http://localhost:${port}${prefix}`);
  logger.log(`API dokümantasyonu: http://localhost:${port}${prefix}/docs`);
}

void bootstrap();
