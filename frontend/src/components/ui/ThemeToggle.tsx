'use client';

import { useTheme } from 'next-themes';

// resolvedTheme은 서버에서 알 수 없어 첫 렌더에 undefined다. 그동안은 라이트로 그린다.
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

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
