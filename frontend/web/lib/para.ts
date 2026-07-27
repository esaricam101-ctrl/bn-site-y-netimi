/**
 * Para bicimlendirme — ADR-0007
 *
 * API decimal STRING dondurur, number DEGIL. Bu dosya string'i bozmadan
 * bicimlendirir; Number() donusumu YAPILMAZ (kayip riski).
 */
export function paraBicimle(decimalString: string, paraBirimi = 'TRY'): string {
  const negatif = decimalString.startsWith('-');
  const mutlak = negatif ? decimalString.slice(1) : decimalString;
  const parcalar = mutlak.split('.');
  const tam = parcalar[0] ?? '0';
  const ondalik = (parcalar[1] ?? '0000').slice(0, 2).padEnd(2, '0');

  const gruplu = tam.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const simge = paraBirimi === 'TRY' ? '₺' : paraBirimi;
  return `${negatif ? '-' : ''}${gruplu},${ondalik} ${simge}`;
}

/**
 * Finansal tarih bicimlendirme — BFS v1 §4.3
 *
 * Arayuz finansal tarihleri TARAYICI YERELINE gore bicimlendirmez;
 * tenant saat dilimini ACIKCA kullanir.
 */
export function tarihBicimle(isoTarih: string, tenantSaatDilimi: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: tenantSaatDilimi, day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(isoTarih));
}
