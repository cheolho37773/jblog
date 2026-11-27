import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';

// 루트 title 템플릿이 붙어 `페이지를 찾을 수 없습니다 | jblog`가 된다.
export const notFoundMetadata: Metadata = {
  title: '페이지를 찾을 수 없습니다',
};

/** 404 안내 (UI §7.7): 그라디언트 `404` + 설명 + Home 버튼, 가운데 정렬. */
export function NotFoundContent() {
  return (
    <Container className="flex flex-col items-center gap-6 py-24 text-center">
      <p className="text-display-hero font-display text-gradient-primary">404</p>
      <p className="text-b3 text-body">페이지를 찾을 수 없습니다.</p>
      <Button asChild variant="pillSolid">
        <Link href="/">Home</Link>
      </Button>
    </Container>
  );
}
