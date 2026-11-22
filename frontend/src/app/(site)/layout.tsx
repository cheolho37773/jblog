import type { ReactNode } from 'react';
import { Footer } from '@/components/layout/Footer';
import { Navbar } from '@/components/layout/Navbar';

// body가 세로 flex라 Navbar(sticky)·main·Footer를 body의 직계 자식으로 둔다. Footer에는 값을 넘기지 않는다. 소개·연락처·카테고리는 API가 붙는 M2~M3에서 연결한다.
export default function SiteLayout({ children }: { children: ReactNode }) {
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
      <Footer />
    </>
  );
}
