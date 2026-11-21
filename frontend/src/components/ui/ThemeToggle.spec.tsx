import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeToggle } from './ThemeToggle';

// next-themes는 브라우저 저장소·matchMedia에 기대므로, 컴포넌트가 훅을 어떻게 쓰는지만 검증한다.
const themeState = vi.hoisted(() => ({
  resolvedTheme: 'light' as string | undefined,
  setTheme: vi.fn(),
}));

vi.mock('next-themes', () => ({
  useTheme: () => themeState,
}));

const TOGGLE_NAME = '다크 모드';

function renderToggleWith(resolvedTheme: 'light' | 'dark') {
  themeState.resolvedTheme = resolvedTheme;
  render(<ThemeToggle />);
  return screen.getByRole('switch', { name: TOGGLE_NAME });
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    themeState.resolvedTheme = 'light';
  });

  it('이름이 "다크 모드"인 switch로 보인다', () => {
    expect(renderToggleWith('light')).toBeInTheDocument();
  });

  it('라이트 테마이면 aria-checked가 false다', () => {
    expect(renderToggleWith('light')).toHaveAttribute('aria-checked', 'false');
  });

  it('다크 테마이면 aria-checked가 true다', () => {
    expect(renderToggleWith('dark')).toHaveAttribute('aria-checked', 'true');
  });

  it('라이트에서 클릭하면 setTheme("dark")를 요청한다', async () => {
    await userEvent.click(renderToggleWith('light'));

    expect(themeState.setTheme).toHaveBeenCalledExactlyOnceWith('dark');
  });

  it('다크에서 클릭하면 setTheme("light")를 요청한다', async () => {
    await userEvent.click(renderToggleWith('dark'));

    expect(themeState.setTheme).toHaveBeenCalledExactlyOnceWith('light');
  });
});
