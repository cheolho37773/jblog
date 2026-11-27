'use client';

import { Container } from '@/components/layout/Container';
import { ErrorNotice } from '@/components/layout/ErrorNotice';

/**
 * 글 상세의 오류 경계(예: 내부 API 401·5xx·네트워크 오류). 사이트 공통 오류 화면(ErrorNotice)을 그린다.
 * 이 파일이 없으면 상위의 목록 전용 경계(blog/error.tsx, "글 목록을 불러오지 못했습니다")가 상세 오류까지 잡는다.
 */
export default function PostError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Container className="pt-6 pb-16">
      <ErrorNotice onRetry={reset} />
    </Container>
  );
}
