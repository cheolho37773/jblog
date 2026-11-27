'use client';

import { Container } from '@/components/layout/Container';
import { ErrorNotice } from '@/components/layout/ErrorNotice';

/**
 * 사이트 페이지 공통 오류 경계. Navbar·Footer가 있는 (site) 화면 안에 그린다.
 * 예: 글 상세의 내부 API 401·5xx. 이 경계는 같은 세그먼트의 layout((site)/layout, Footer 조회) 오류는 잡지 못한다(Next 규칙) — 그것은 app/error.tsx가 맡는다.
 */
export default function SiteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Container className="pt-6 pb-16">
      <ErrorNotice onRetry={reset} />
    </Container>
  );
}
