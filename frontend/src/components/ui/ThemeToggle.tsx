'use client';

import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from './Icon';

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
    // 트랙 48x28, 노브 24x24 (UI §5.1). after로 클릭 영역을 44px 높이까지 넓힌다 (UI §4.2).
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="다크 모드"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="bg-toggle-track relative h-7 w-12 shrink-0 rounded-full after:absolute after:-inset-2 after:content-['']"
    >
      <span
        className={cn(
          'shadow-toggle absolute top-0.5 left-0.5 flex size-6 items-center justify-center rounded-full bg-white text-black transition-transform duration-200 ease-in-out',
          isDark && 'translate-x-5',
        )}
      >
        <Icon name={isDark ? 'moon' : 'sun'} size={14} />
      </span>
    </button>
  );
}
