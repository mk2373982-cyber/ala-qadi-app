import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { InstallPrompt } from '@/components/InstallPrompt';

export const metadata: Metadata = {
  title: 'على قدي - إدارة مالية شخصية',
  description: 'تطبيق إدارة مالية شخصية محلي وسهل الاستخدام، يحفظ بياناتك على جهازك ويعمل بدون إنترنت',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'على قدي',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#087c50',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-[#f3f8f4] text-slate-800 antialiased min-h-screen flex flex-col selection:bg-brand-200 selection:text-brand-900">
        <AuthProvider>
          <ServiceWorkerRegister />
          <InstallPrompt />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
