import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ThemeProvider } from '@/components/ui/ThemeProvider';
import { env } from '@/lib/env';
import { fontVariableClassNames } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(env.public.NEXT_PUBLIC_SITE_URL),
  // 하위 페이지 title에 사이트 이름을 붙인다 (프론트엔드 §9). title이 없는 페이지는 default를 쓴다.
  title: { default: 'jblog', template: '%s | jblog' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // next-themes가 하이드레이션 전에 data-theme을 넣으므로 이 경고만 끈다.
  return (
    <html
      lang="ko"
      className={`${fontVariableClassNames} has-[dialog[open]]:overflow-hidden`}
      suppressHydrationWarning
    >
      <body className="flex min-h-dvh flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
