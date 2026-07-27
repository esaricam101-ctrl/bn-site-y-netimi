/** Domain hatalarinin ortak tabani. RFC 7807 yanitina donusturulur (BFS v1 §12). */
export abstract class DomainHatasi extends Error {
  abstract readonly kod: string;
  abstract readonly httpDurum: number;
  /** Kullaniciya gosterilecek tek net sonraki eylem (BFS v1 §12). */
  readonly sonrakiEylem: string | undefined;

  constructor(mesaj: string, sonrakiEylem?: string) {
    super(mesaj);
    this.name = new.target.name;
    this.sonrakiEylem = sonrakiEylem;
  }
}

export class DogrulamaHatasi extends DomainHatasi {
  override readonly kod = 'DOGRULAMA_HATASI';
  override readonly httpDurum = 422;
}
export class KayitBulunamadi extends DomainHatasi {
  override readonly kod = 'KAYIT_BULUNAMADI';
  override readonly httpDurum = 404;
}
export class YetkiYok extends DomainHatasi {
  override readonly kod = 'YETKI_YOK';
  override readonly httpDurum = 403;
}
export class CakismaHatasi extends DomainHatasi {
  override readonly kod = 'CAKISMA';
  override readonly httpDurum = 409;
}
export class IsKuraliIhlali extends DomainHatasi {
  override readonly kod = 'IS_KURALI_IHLALI';
  override readonly httpDurum = 422;
}
