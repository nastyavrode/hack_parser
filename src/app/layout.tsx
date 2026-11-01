import type { Metadata } from 'next';
import './globals.css';
import { siteConfig } from '@/shared/config/site';
import { SiteHeader } from '@/widgets/site-header/ui/site-header';
import { SiteFooter } from '@/widgets/site-footer/ui/site-footer';
import { Providers } from '@/app/providers';

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: 'HackTeen — найди свой следующий хакатон', template: '%s | HackTeen' },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    siteName: siteConfig.name,
    title: 'HackTeen — найди свой следующий хакатон',
    description: siteConfig.description,
  },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>
        <Providers>
          <SiteHeader />
          {children}
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
