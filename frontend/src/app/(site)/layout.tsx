import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { SiteChrome } from '../SiteChrome';

// Footer 카테고리는 요청 시 조회한다(빌드 중 API 호출 금지). 조회가 실패하면 (site)의 모든 페이지가 오류로 끝난다(app/error.tsx).
export default async function SiteLayout({ children }: { children: ReactNode }) {
  await connection();
  return <SiteChrome>{children}</SiteChrome>;
}
