import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Navbar } from './Navbar';

// Navbar는 Logo·메뉴·검색·테마 토글·모바일 메뉴를 조립하는 셸이다. 하위 훅만 모킹한다.
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }),
}));

describe('Navbar', () => {
  it('banner 영역에 로고 링크와 메뉴 링크가 있다', () => {
    render(<Navbar />);

    const banner = screen.getByRole('banner');
    expect(within(banner).getByRole('link', { name: 'jblog 홈' })).toHaveAttribute('href', '/');
    expect(within(banner).getAllByRole('link', { name: 'Blog' }).length).toBeGreaterThan(0);
  });

  it('banner 영역에 검색(searchbox)과 테마 토글이 있다', () => {
    render(<Navbar />);

    const banner = screen.getByRole('banner');
    expect(within(banner).getByRole('searchbox', { name: '검색' })).toBeInTheDocument();
    expect(within(banner).getByRole('switch', { name: '다크 모드' })).toBeInTheDocument();
  });

  it('햄버거 버튼은 "메뉴 열기" 이름, aria-expanded=false, 존재하는 메뉴를 aria-controls로 가리킨다', () => {
    render(<Navbar />);

    const button = within(screen.getByRole('banner')).getByRole('button', { name: '메뉴 열기' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    const controlsId = button.getAttribute('aria-controls');
    expect(controlsId).toBeTruthy();
    expect(document.getElementById(controlsId as string)).not.toBeNull();
  });
});
