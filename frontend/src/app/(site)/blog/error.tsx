'use client';

import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';

/**
 * 목록 조회 실패는 빈 목록으로 숨기지 않고 오류로 보여 준다 (프론트엔드 §4 "빌드와 데이터").
 * `/blog` 목록 전용이다. 하위 상세(`blog/[slug]`)는 자기 error.tsx(공통 오류 화면)가 먼저 잡는다.
 */
export default function BlogError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Container className="pt-6 pb-16">
      <div
        data-testid="blog-error"
        role="alert"
        className="flex flex-col items-center gap-6 py-16 text-center"
      >
        <p className="text-h4 text-strong">글 목록을 불러오지 못했습니다</p>
        <p className="text-b4 text-muted">잠시 후 다시 시도해 주세요.</p>
        <Button variant="outline" onClick={reset}>
          다시 시도
        </Button>
      </div>
    </Container>
  );
}
