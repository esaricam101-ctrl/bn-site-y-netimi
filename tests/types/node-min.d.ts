/**
 * ASGARİ Node tip tanımları — YALNIZCA çevrimdışı test derlemesi için.
 *
 * `@types/node` harici bir bağımlılıktır ve paket kayıt sunucusuna erişim
 * olmayan ortamda kurulamaz (VALIDATION_REPORT §5.1). Bu dosya, framework
 * bağımsız modüllerin çevrimdışı derlenip test edilebilmesini sağlar.
 *
 * ÜRETİM DERLEMESİNDE KULLANILMAZ. `backend/tsconfig.json` gerçek
 * `@types/node` paketini kullanır; CI'da tam tip denetimi orada yapılır.
 * Buradaki imzalar kasıtlı olarak dardır — yalnızca test edilen modüllerin
 * ihtiyacı kadarını tanımlar, gerçek tiplerin yerine geçmez.
 */

declare class Buffer extends Uint8Array {
  static from(deger: string, kodlama?: string): Buffer;
  static from(deger: ArrayLike<number>): Buffer;
  toString(kodlama?: string): string;
}

declare module 'node:crypto' {
  export function randomBytes(boyut: number): Buffer;
  export function scrypt(
    parola: string | Buffer,
    tuz: string | Buffer,
    uzunluk: number,
    secenekler: { N: number; r: number; p: number; maxmem: number },
    geriCagri: (hata: Error | null, tuncak: Buffer) => void,
  ): void;
  export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean;
}

declare module 'node:util' {
  export function promisify<T extends (...argv: never[]) => unknown>(fn: T): unknown;
}
