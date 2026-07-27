/**
 * Şifre servisi — `sifre.ts` içindeki saf fonksiyonların enjekte edilebilir
 * sarmalayıcısı. Mantık burada DEĞİLDİR; framework bağımsız kalması için
 * ayrı dosyada durur ve orada test edilir (BFS v1 §1.3).
 */
import { Injectable } from '@nestjs/common';
import { sifreDogrula, sifreOzetle, yukseltmeGerekliMi } from './sifre';

@Injectable()
export class SifreServisi {
  ozetle(parola: string): Promise<string> {
    return sifreOzetle(parola);
  }

  dogrula(parola: string, kayitliOzet: string): Promise<boolean> {
    return sifreDogrula(parola, kayitliOzet);
  }

  yukseltmeGerekliMi(kayitliOzet: string): boolean {
    return yukseltmeGerekliMi(kayitliOzet);
  }
}
