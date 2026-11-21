import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ThemeProvider } from '@/components/ui/ThemeProvider';
import { env } from '@/lib/env';
import { fontVariableClassNames } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(env.public.NEXT_PUBLIC_SITE_URL),
  title: 'jblog',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // next-themes가 하이드레이션 전에 data-theme을 넣으므로 이 경고만 끈다.
  return (
    <html lang="ko" className={fontVariableClassNames} suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
