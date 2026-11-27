'use client';

import { useEffect, useState } from 'react';
import type { Heading } from '@/lib/markdown';
import { cn } from '@/lib/cn';

type TableOfContentsProps = {
  headings: Heading[];
  className?: string;
};

// 헤딩 위치가 이 선(화면 위에서 px)을 지나면 그 헤딩을 현재 항목으로 본다.
// 헤딩의 scroll-margin-top(Navbar 아래 32, prose-jblog.css)과 같고, 반올림 오차 몇 px을 더 허용한다.
const HEADING_SCROLL_MARGIN = 133;
const ACTIVE_LINE_SLACK = 8;
const ACTIVE_LINE = HEADING_SCROLL_MARGIN + ACTIVE_LINE_SLACK;

/** 화면 위쪽 선을 지난 마지막 헤딩. 아직 아무 헤딩도 지나지 않았으면 첫 헤딩이다. */
function findCurrentId(headings: Heading[]): string | undefined {
  let current = headings[0]?.id;
  for (const { id } of headings) {
    const element = document.getElementById(id);
    if (!element) continue;
    if (element.getBoundingClientRect().top > ACTIVE_LINE) break;
    current = id;
  }
  return current;
}

/**
 * 스크롤 위치에 따라 현재 헤딩 id를 돌려준다.
 * scroll·resize 이벤트는 브라우저가 이미 한 프레임에 한 번만 보내므로 따로 묶지 않고 바로 계산한다(헤딩 몇 개의 위치만 읽는다).
 */
function useCurrentHeadingId(headings: Heading[]): string | undefined {
  const [currentId, setCurrentId] = useState<string>();

  useEffect(() => {
    const update = () => setCurrentId(findCurrentId(headings));
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [headings]);

  return currentId;
}

// h3는 h2 아래 단계로 들여 쓴다.
// 현재 항목 색은 스크롤 위치를 바로 따라가야 해서 전역 색 전환(200ms, globals.css)을 끈다. 끄지 않으면 빠르게 스크롤할 때 이전 항목 색이 남는다.
// 전역 규칙은 레이어 밖(body *)이라 레이어 안의 유틸이 이기려면 !important가 필요하다.
const LINK = 'text-b5 block wrap-anywhere transition-none! hover:text-primary-text';
const DEPTH_INDENT = { 2: '', 3: 'pl-3' } as const;

/**
 * 본문 목차 (UI §7.3). 본문 h2·h3의 `#id` 링크이고, 화면에 보이는 현재 항목만 `aria-current="location"`이다.
 * 화면 폭 조건(≥1280)은 이 컴포넌트가 아니라 DesktopTableOfContents가 정한다.
 */
export function TableOfContents({ headings, className }: TableOfContentsProps) {
  const currentId = useCurrentHeadingId(headings);
  if (headings.length === 0) return null;

  return (
    <nav aria-label="목차" className={cn('w-50', className)}>
      <ol className="flex flex-col gap-2">
        {headings.map((heading) => {
          const isCurrent = heading.id === currentId;
          return (
            <li key={heading.id} className={DEPTH_INDENT[heading.depth]}>
              <a
                href={`#${heading.id}`}
                aria-current={isCurrent ? 'location' : undefined}
                className={cn(LINK, isCurrent ? 'text-primary-text' : 'text-muted')}
              >
                {heading.text}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
