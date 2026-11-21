'use client';

import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';

const subscribeNothing = () => () => {};

// 서버·하이드레이션 중에는 false, 하이드레이션이 끝난 클라이언트에서는 true다.
// 저장된 테마는 서버가 모르므로, 마운트 전에는 서버와 같은 모양으로 그려 불일치를 막는다.
function useIsMounted(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isMounted = useIsMounted();
  const isDark = isMounted && resolvedTheme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="다크 모드"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="border-border-strong rounded-md border px-3 py-1"
    >
      {isDark ? '다크' : '라이트'}
    </button>
  );
}
