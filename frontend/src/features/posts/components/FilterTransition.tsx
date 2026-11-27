'use client';

import { useRouter } from 'next/navigation';
import { createContext, useContext, useTransition, type MouseEvent, type ReactNode } from 'react';
import { POST_GRID_CLASS } from './post-grid-class';
import { PostCardSkeleton } from './PostCardSkeleton';

const SKELETON_COUNT = 9;

const PendingContext = createContext(false);

type Navigate = (href: string) => void;
const NavigateContext = createContext<Navigate>(() => {});

/**
 * 칩을 눌러 목록이 바뀌는 동안(클라이언트 전환)만 "바뀌는 중"을 알린다 (프론트엔드 §6.2).
 * 경로 단위 loading.tsx는 응답을 먼저 보내 404 상태와 JS 없는 렌더를 깨므로 쓰지 않는다.
 */
export function FilterTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const navigate: Navigate = (href) => startTransition(() => router.push(href));

  return (
    <NavigateContext.Provider value={navigate}>
      <PendingContext.Provider value={isPending}>{children}</PendingContext.Provider>
    </NavigateContext.Provider>
  );
}

// 새 탭·다운로드 같은 브라우저 기본 동작은 가로채지 않는다.
function isPlainLeftClick(event: MouseEvent): boolean {
  const hasModifier = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
  return event.button === 0 && !hasModifier;
}

/**
 * 안의 링크 클릭을 전환(useTransition)으로 보낸다. 링크는 그대로 진짜 `a[href]`라 JS 없이도 이동한다.
 * 링크 컴포넌트보다 먼저 받으려고 캡처 단계에서 처리한다.
 */
export function FilterLinks({ children }: { children: ReactNode }) {
  const navigate = useContext(NavigateContext);

  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    const link = (event.target as Element).closest('a[href]');
    if (!link || link.getAttribute('target') || !isPlainLeftClick(event)) return;
    event.preventDefault();
    navigate(link.getAttribute('href') ?? '/blog');
  }

  return <div onClickCapture={handleClickCapture}>{children}</div>;
}

/** 전환 중에는 Overlay·그리드·Load More 자리에 스켈레톤 9개를 보여 준다. */
export function PendingListSlot({ children }: { children: ReactNode }) {
  const isPending = useContext(PendingContext);
  if (!isPending) return children;

  return (
    <div data-testid="blog-loading-grid" className={POST_GRID_CLASS}>
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <PostCardSkeleton key={index} />
      ))}
    </div>
  );
}
