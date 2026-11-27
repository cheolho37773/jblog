import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { Footer } from '@/components/layout/Footer';
import { Navbar } from '@/components/layout/Navbar';
import { loadCategories } from '@/features/posts/lib/blog-list-api';

const FOOTER_CATEGORY_LIMIT = 6;

// body가 세로 flex라 Navbar(sticky)·main·Footer를 body의 직계 자식으로 둔다. 소개·연락처는 M3에서 연결한다.
// Footer 카테고리는 요청 시 조회한다(빌드 중 API 호출 금지). 조회가 실패하면 (site)의 모든 페이지가 오류로 끝난다.
export default async function SiteLayout({ children }: { children: ReactNode }) {
  await connection();
  const categories = (await loadCategories())
    .filter((category) => category.postCount > 0)
    .slice(0, FOOTER_CATEGORY_LIMIT);

  return (
    <>
      <a
        href="#main"
        className="bg-surface text-strong border-border focus:fixed focus:top-2 focus:left-2 focus:z-50 not-focus:sr-only rounded-md border px-4 py-2"
      >
        본문으로 건너뛰기
      </a>
      <Navbar />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer categories={categories} />
    </>
  );
}
