'use client';

import { useSyncExternalStore } from 'react';
import type { Heading } from '@/lib/markdown';
import { TableOfContents } from './TableOfContents';

// globals.css --breakpoint-desktop(1280)과 같은 값. TOC는 이 폭 이상에서만 그린다 (UI §7.3).
const DESKTOP_QUERY = '(min-width: 1280px)';

function subscribeDesktop(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

const isDesktop = () => window.matchMedia(DESKTOP_QUERY).matches;
// 서버는 화면 폭을 모르므로 그리지 않고, 하이드레이션 뒤 폭을 보고 그린다.
const isDesktopOnServer = () => false;

/**
 * ≥1280에서만 목차를 그린다. CSS로 숨기지 않고 DOM에서 뺀다:
 * 좁은 화면에서 보이지 않는 링크가 Tab 순서·보조 기술에 남지 않게 하려는 것이다.
 */
export function DesktopTableOfContents({
  headings,
  className,
}: {
  headings: Heading[];
  className?: string;
}) {
  const desktop = useSyncExternalStore(subscribeDesktop, isDesktop, isDesktopOnServer);
  if (!desktop) return null;
  return <TableOfContents headings={headings} className={className} />;
}
