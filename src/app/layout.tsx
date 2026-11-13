import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { InstallPrompt } from '@/components/InstallPrompt';
import { ConfirmActionProvider } from '@/components/ConfirmActionProvider';

export const metadata: Metadata = {
  title: 'على قدي - إدارة مالية شخصية',
  description:
    'تطبيق إدارة مالية شخصية يحفظ سجلاتك المالية على جهازك ويتيح استخدامها دون اتصال بعد تسجيل الدخول.',
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="flex min-h-screen flex-col bg-[#f8fafc] text-slate-800 antialiased selection:bg-emerald-100 selection:text-emerald-950">
        <AuthProvider>
          <ConfirmActionProvider>
            <ServiceWorkerRegister />
            <InstallPrompt />
            {children}
          </ConfirmActionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
