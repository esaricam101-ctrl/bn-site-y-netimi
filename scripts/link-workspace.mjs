#!/usr/bin/env node
/**
 * Workspace baglantilarini kurar — pnpm install olmadan.
 *
 * shared/* paketlerinin calisma zamani bagimliligi SIFIRDIR (ADR-0007).
 * Bu nedenle aralarindaki baglantilar tek basina kurulabilir ve derlenmis
 * kod, paket kayit sunucusuna erisim OLMADAN calistirilabilir.
 *
 * `pnpm install` calistirildiginda bu baglantilar pnpm tarafindan
 * yonetilenlerle degistirilir; betik zararsizca tekrar calistirilabilir.
 */
import { mkdirSync, symlinkSync, existsSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// .pathname Windows'ta '/C:/...' verir ve birlestirince 'C:\C:\...' olusur.
const KOK = fileURLToPath(new URL('..', import.meta.url));
const hedefDizin = join(KOK, 'node_modules', '@bnos');

mkdirSync(hedefDizin, { recursive: true });

const paketler = readdirSync(join(KOK, 'shared')).filter((a) =>
  statSync(join(KOK, 'shared', a)).isDirectory(),
);

let kurulan = 0;
for (const p of paketler) {
  const kaynak = join(KOK, 'shared', p);
  const hedef = join(hedefDizin, p);
  if (existsSync(hedef)) rmSync(hedef, { recursive: true, force: true });
  // Windows'ta 'dir' symlink yonetici yetkisi ister; junction istemez ve
  // mutlak yol bekler. POSIX'te goreli symlink korunur.
  if (process.platform === 'win32') symlinkSync(kaynak, hedef, 'junction');
  else symlinkSync(relative(dirname(hedef), kaynak), hedef, 'dir');
  kurulan++;
}

console.log(`Workspace baglantilari kuruldu: ${kurulan} paket -> node_modules/@bnos/`);
