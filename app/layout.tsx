import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import PWAClient from './components/PWAClient';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'AI Stock Dashboard - Indian Markets',
  description: 'AI-powered Indian stock market dashboard with intelligent recommendations',
  manifest: '/manifest.json',
  applicationName: 'AI Dashboard',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AI Dashboard',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#1e40af',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* Apple-specific PWA hints — Next metadata API covers most, but
            these extra ones make the iOS "Add to Home Screen" look right. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} ${inter.className}`} suppressHydrationWarning>
        <PWAClient />
        {children}
      </body>
    </html>
  );
}
