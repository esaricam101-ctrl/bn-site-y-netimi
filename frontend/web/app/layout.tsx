import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark',
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
    <html lang="tr">
      <body data-density="rahat">
        <NextIntlClientProvider messages={messages}>
          {/* Erisilebilirlik: klavye kullanicisi icin atlama baglantisi */}
          <a href="#icerik" className="skip">
            {t('genelBakis')}
          </a>
          <div id="icerik">{children}</div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
