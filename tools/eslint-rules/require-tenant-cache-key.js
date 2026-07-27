/**
 * ESLint kuralı: bnos/require-tenant-cache-key
 *
 * Kaynak: ADR-0005 · ADR v1.1 §37 · BFS v1 §7.1
 *
 * tenantId içermeyen önbellek anahtarı, çok kiracılı sistemde VERİ SIZINTISIDIR.
 * RLS önbelleği korumaz.
 *
 * Bu kural iki şeyi reddeder:
 *   1. Redis/cache istemcisine ham string anahtar geçirilmesi
 *   2. Yasaklı finansal alanların önbelleklenmesi
 *
 * Meşru tek yol: onbellekAnahtari({ tenantId, alan, kimlik, surum })
 */

const CACHE_METOTLARI = new Set([
  'get', 'set', 'setex', 'del', 'mget', 'mset', 'incr', 'expire', 'hget', 'hset',
]);

const CACHE_NESNELERI = /^(redis|cache|onbellek|cacheManager|redisClient)$/i;

const YASAKLI_ALANLAR = [
  'bakiye', 'cari-hesap', 'borc-durumu', 'yaslandirma', 'nakit', 'mizan', 'defter',
];

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Önbellek anahtarları onbellekAnahtari() ile üretilmeli ve tenantId taşımalıdır',
    },
    schema: [],
    messages: {
      hamAnahtar:
        'Önbellek anahtarı ham string olamaz. onbellekAnahtari({ tenantId, alan, kimlik, surum }) ' +
        'kullanın — tenantId içermeyen anahtar veri sızıntısıdır (ADR v1.1 §37).',
      tenantYok:
        'Önbellek anahtarı tenantId taşımıyor. Biçim: t:{tenantId}:{alan}:{kimlik}:{sürüm} ' +
        '(BFS v1 §7.1).',
      yasakliAlan:
        "'{{alan}}' önbelleklenemez. Finansal bakiye, cari hesap ve borç durumu her zaman " +
        'kaynaktan okunur (ADR-0005). Performans için transaction içinde bakımı yapılan ' +
        'özet tablo kullanın — özet tablo önbellek değildir (BFS v1 §7.4).',
    },
  },

  create(context) {
    const anahtarIcerigiKontrol = (node, deger) => {
      const kucuk = String(deger).toLowerCase();
      const yasakli = YASAKLI_ALANLAR.find((a) => kucuk.includes(a));
      if (yasakli) {
        context.report({ node, messageId: 'yasakliAlan', data: { alan: yasakli } });
        return;
      }
      if (!kucuk.startsWith('t:')) {
        context.report({ node, messageId: 'tenantYok' });
      }
    };

    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== 'MemberExpression') return;
        if (callee.property.type !== 'Identifier') return;
        if (!CACHE_METOTLARI.has(callee.property.name)) return;

        const nesneAdi =
          callee.object.type === 'Identifier'
            ? callee.object.name
            : callee.object.type === 'MemberExpression' &&
                callee.object.property.type === 'Identifier'
              ? callee.object.property.name
              : '';
        if (!CACHE_NESNELERI.test(nesneAdi)) return;

        const anahtar = node.arguments[0];
        if (!anahtar) return;

        // Meşru yol: onbellekAnahtari(...) çağrısı
        if (
          anahtar.type === 'CallExpression' &&
          anahtar.callee.type === 'Identifier' &&
          anahtar.callee.name === 'onbellekAnahtari'
        ) {
          return;
        }

        if (anahtar.type === 'Literal' && typeof anahtar.value === 'string') {
          anahtarIcerigiKontrol(anahtar, anahtar.value);
          return;
        }

        if (anahtar.type === 'TemplateLiteral') {
          const gorunur = anahtar.quasis.map((q) => q.value.cooked ?? '').join('');
          anahtarIcerigiKontrol(anahtar, gorunur);
          return;
        }

        context.report({ node: anahtar, messageId: 'hamAnahtar' });
      },
    };
  },
};
