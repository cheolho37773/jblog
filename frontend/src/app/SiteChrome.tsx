import type { ReactNode } from 'react';
import { Footer } from '@/components/layout/Footer';
import { Navbar } from '@/components/layout/Navbar';
import { loadCategories } from '@/features/posts/lib/blog-list-api';

const FOOTER_CATEGORY_LIMIT = 6;

/**
 * 사이트 공통 틀: 건너뛰기 링크 · Navbar · main · Footer.
 * (site)/layout과 루트 not-found(어느 라우트에도 맞지 않는 주소)가 함께 쓴다.
 * body가 세로 flex라 Navbar(sticky)·main·Footer를 body의 직계 자식으로 둔다. 소개·연락처는 M3에서 연결한다.
 * Footer 카테고리는 요청 시 조회한다. 호출 쪽이 connection()으로 요청 시 렌더를 보장한다(빌드 중 API 호출 금지).
 */
export async function SiteChrome({ children }: { children: ReactNode }) {
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
