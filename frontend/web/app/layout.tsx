import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { GorunumSaglayici } from '@/components/gorunum-saglayici';
import { BildirimSaglayici } from '@/components/bildirim';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Iki tema da desteklenir; etkin olani GorunumSaglayici belirler ve
  // `document.documentElement.style.colorScheme` ile tarayiciya bildirir.
  colorScheme: 'dark light',
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('genel');
  return {
    title: t('uygulamaAdi'),
    description: 'Çok kiracılı, KMK uyumlu apartman yönetim platformu',
  };
}

export default async function RootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const messages = await getMessages();
  const t = await getTranslations('navigasyon');

  return (
    // `data-theme` istemcide GorunumSaglayici tarafindan yazilir; sunucu
    // ciktisi koyu temadir ve hydration uyusmazligi olusmaz.
    <html lang="tr" data-theme="koyu">
      <body data-density="rahat">
        <NextIntlClientProvider messages={messages}>
          <GorunumSaglayici>
            <BildirimSaglayici>
              {/* Erisilebilirlik: klavye kullanicisi icin atlama baglantisi */}
              <a href="#icerik" className="skip">
                {t('genelBakis')}
              </a>
              <div id="icerik">{children}</div>
            </BildirimSaglayici>
          </GorunumSaglayici>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
