'use client';

import { Container } from '@/components/layout/Container';
import { ErrorNotice } from '@/components/layout/ErrorNotice';

/**
 * (site)/layout 자체가 실패할 때(예: Footer 카테고리 조회 실패)의 오류 경계.
 * 사이트 layout 밖이라 Navbar·Footer 없이 루트 layout(테마·글꼴) 안에 최소 화면만 그린다.
 * 루트 layout은 데이터를 조회하지 않아 global-error는 두지 않는다.
 */
export default function RootError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex-1">
      <Container className="pt-6 pb-16">
        <ErrorNotice onRetry={reset} />
      </Container>
    </main>
  );
}
