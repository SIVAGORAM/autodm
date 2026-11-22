// app/layout.tsx
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from 'sonner';
import { getPublicSiteUrl } from '../lib/site-url';

// Inter, bundled locally (SIL Open Font License) — see app/fonts/Inter-OFL-LICENSE.txt.
// Served from the repo so production builds never depend on fonts.googleapis.com.
const inter = localFont({
  src: [
    { path: './fonts/InterVariable.woff2', style: 'normal' },
    { path: './fonts/InterVariable-Italic.woff2', style: 'italic' },
  ],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: getPublicSiteUrl(),
  title: 'HeyLaunch — Start conversations. Launch possibilities.',
  description: 'Build your online presence, automate Instagram engagement, and turn conversations into customers — all from one platform.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          {children}
          <Toaster richColors position="bottom-right" expand={true} />
        </Providers>
      </body>
    </html>
  );
}
