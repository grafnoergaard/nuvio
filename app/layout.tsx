import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { SettingsProvider } from '@/lib/settings-context';
import { AuthProvider } from '@/lib/auth-context';
import { UIStringsProvider } from '@/lib/ui-strings-context';
import { TypographyProvider } from '@/lib/typography-context';
import { DesignApplier } from '@/components/design-applier';
import { AppShell } from '@/components/app-shell';
import { AdminLabelProvider } from '@/components/admin-page-label';
import { TypographyInspectorProvider } from '@/lib/typography-inspector-context';
import { TypographyInspector } from '@/components/typography-inspector';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Kuvert',
  description: 'Budgetstyring med kuvert-metoden',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
};


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="da" className={inter.variable}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="theme-color" content="rgb(236,253,245)" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Kuvert" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Kuvert" />
        <meta name="format-detection" content="telephone=no" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/nuvio.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/nuvio.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/nuvio.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/nuvio.png" />
        <link rel="icon" type="image/png" href="/nuvio.png" />
      </head>
      <body className="font-sans">
        <AuthProvider>
          <UIStringsProvider>
            <SettingsProvider>
              <TypographyProvider>
                <TypographyInspectorProvider>
                  <DesignApplier />
                  <AdminLabelProvider>
                    <AppShell>
                      {children}
                    </AppShell>
                  </AdminLabelProvider>
                  <TypographyInspector />
                  <Toaster />
                </TypographyInspectorProvider>
              </TypographyProvider>
            </SettingsProvider>
          </UIStringsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
