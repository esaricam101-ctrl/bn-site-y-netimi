/**
 * Nesne deposu (S3 / MinIO) adaptörü.
 *
 * DOSYA API'DEN GEÇMEZ. Yükleme ve indirme ÖNİMZALI URL ile doğrudan depoya
 * yapılır. Gerekçe:
 *   - 50 MB'lık bir yönetim planını Node süreci üzerinden akıtmak, eşzamanlı
 *     birkaç yüklemede bellek ve olay döngüsünü tıkar.
 *   - Dosya API'den geçmediği için içerik hiç bir zaman uygulama belleğine
 *     alınmaz; sızıntı yüzeyi küçülür.
 *
 * BEDELİ: istemci önimzalı URL'i alıp dosyayı yüklemeden üstveri kaydı
 * açabilir. Bu yüzden kayıt açılmadan önce nesnenin GERÇEKTEN var olduğu
 * `nesneVarMi` ile doğrulanır — aksi halde veritabanında dosyası olmayan
 * belge kayıtları birikir ve "belge var" diyen bir liste indirilemeyen
 * satırlarla dolar.
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  CreateBucketCommand, GetObjectCommand, HeadBucketCommand, HeadObjectCommand,
  PutObjectCommand, S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface NesneBilgisi {
  readonly boyut: number;
  readonly icerikTipi: string;
  /** S3 ETag — çok parçalı yüklemede MD5 DEĞİLDİR, yalnızca değişim işaretidir. */
  readonly etag: string | null;
}

/** Önimzalı URL ömrü. Kısa tutulur: sızan bir URL süresiz erişim vermemeli. */
const URL_OMRU_SN = 300;

@Injectable()
export class NesneDeposuServisi implements OnModuleInit {
  private readonly logger = new Logger('NesneDeposu');
  private readonly istemci: S3Client;
  private readonly kova: string;

  constructor() {
    const uc = process.env['S3_ENDPOINT'] ?? 'http://localhost:9000';
    this.kova = process.env['S3_BUCKET'] ?? 'bnos-apartman';
    this.istemci = new S3Client({
      endpoint: uc,
      region: process.env['S3_REGION'] ?? 'us-east-1',
      // MinIO alt alan adı biçimini desteklemez; yol biçimi ZORUNLUDUR.
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env['S3_ACCESS_KEY'] ?? 'minio',
        secretAccessKey: process.env['S3_SECRET_KEY'] ?? 'minio12345',
      },
    });
  }

  /**
   * Kova yoksa oluşturur.
   *
   * Başarısızlık uygulamayı DÜŞÜRMEZ: belge modülü dışındaki her şey nesne
   * deposu olmadan da çalışır. Sessiz de kalmaz — açıkça uyarı düşer.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.istemci.send(new HeadBucketCommand({ Bucket: this.kova }));
    } catch {
      try {
        await this.istemci.send(new CreateBucketCommand({ Bucket: this.kova }));
        this.logger.log(`Kova oluşturuldu: ${this.kova}`);
      } catch (hata) {
        this.logger.warn(
          `Nesne deposuna ulaşılamadı (${this.kova}): ${(hata as Error).message}. ` +
            'Belge yükleme çalışmayacak; diğer modüller etkilenmez.',
        );
      }
    }
  }

  /**
   * Nesne anahtarı üretir.
   *
   * TENANT KİMLİĞİYLE ÖNEKLİDİR ve rastgele bir parça taşır: bir tenant'ın
   * anahtarı diğerininkini TAHMİN ETMEYE yaramaz. Anahtar tahmin edilebilir
   * olsaydı, önimzalı URL üretme yetkisi olan biri başka tenant'ın belgesine
   * ulaşabilirdi.
   */
  anahtarUret(tenantId: string, belgeId: string, dosyaAdi: string): string {
    const temiz = dosyaAdi
      .normalize('NFD')
      .replace(/[̀-ͯ]/gu, '')
      .replace(/[^a-zA-Z0-9._-]/gu, '_')
      .slice(-80);
    return `${tenantId}/belge/${belgeId}/${temiz}`;
  }

  yuklemeUrl(anahtar: string, icerikTipi: string): Promise<string> {
    return getSignedUrl(
      this.istemci,
      new PutObjectCommand({ Bucket: this.kova, Key: anahtar, ContentType: icerikTipi }),
      { expiresIn: URL_OMRU_SN },
    );
  }

  indirmeUrl(anahtar: string, dosyaAdi: string): Promise<string> {
    return getSignedUrl(
      this.istemci,
      new GetObjectCommand({
        Bucket: this.kova,
        Key: anahtar,
        // Tarayici dosyayi ACMAK yerine INDIRSIN: HTML/SVG bir belge olarak
        // yuklenip acildiginda depo alan adinda script calistirabilir.
        ResponseContentDisposition: `attachment; filename="${encodeURIComponent(dosyaAdi)}"`,
      }),
      { expiresIn: URL_OMRU_SN },
    );
  }

  /** Nesne gerçekten yüklendi mi — üstveri kaydından ÖNCE doğrulanır. */
  async nesneVarMi(anahtar: string): Promise<NesneBilgisi | null> {
    try {
      const y = await this.istemci.send(
        new HeadObjectCommand({ Bucket: this.kova, Key: anahtar }),
      );
      return {
        boyut: y.ContentLength ?? 0,
        icerikTipi: y.ContentType ?? 'application/octet-stream',
        etag: y.ETag?.replaceAll('"', '') ?? null,
      };
    } catch {
      return null;
    }
  }
}
