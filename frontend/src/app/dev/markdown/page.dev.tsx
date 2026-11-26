import type { Metadata } from 'next';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { env } from '@/lib/env';
import { renderMarkdown } from '@/lib/markdown';
import { Prose } from '@/lib/markdown/Prose';
import { SAMPLE_MARKDOWN } from './sample-markdown';

// 개발 전용 페이지다. JBLOG_DEV_PAGES=1 빌드에서만 라우트가 되고 운영 빌드에는 들어가지 않는다 (next.config.ts).
export const metadata: Metadata = {
  title: 'Markdown (dev)',
  robots: { index: false, follow: false },
};

// 글 상세 본문 폭(UI §7.3: 800px 중앙)
export default async function MarkdownPreviewPage() {
  const content = await renderMarkdown(SAMPLE_MARKDOWN, {
    siteOrigin: new URL(env.public.NEXT_PUBLIC_SITE_URL).origin,
  });
  return (
    <main className="text-body py-8">
      <header className="container-site flex items-center justify-between gap-4 pb-8">
        <h1 className="text-h3-bold text-strong">Markdown</h1>
        <ThemeToggle />
      </header>
      <div className="container-site">
        <Prose data-testid="markdown-preview" className="mx-auto max-w-[800px]">
          {content}
        </Prose>
      </div>
    </main>
  );
}
