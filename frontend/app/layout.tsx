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
  title: 'HeyLaunch — Instagram comment automation for creators',
  description: 'Set keyword rules for supported Instagram post comments, prepare eligible private replies, and review delivery outcomes in one workspace.',
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
