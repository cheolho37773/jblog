import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NavLinks } from './NavLinks';

// 현재 경로만 바꿔 가며 활성 메뉴 규칙을 확인한다 (M1-04 NavLinks 규약).
const navigationState = vi.hoisted(() => ({ pathname: '/' }));

vi.mock('next/navigation', () => ({
  usePathname: () => navigationState.pathname,
}));

const MENUS = [
  { name: 'Home', href: '/' },
  { name: 'Blog', href: '/blog' },
  { name: 'Projects', href: '/projects' },
  { name: 'About', href: '/about' },
  { name: 'Contact', href: '/about#contact' },
];

function activeMenuNames(pathname: string): string[] {
  navigationState.pathname = pathname;
  const { unmount } = render(<NavLinks />);
  const active = screen
    .getAllByRole('link')
    .filter((link) => link.getAttribute('aria-current') === 'page')
    .map((link) => link.textContent ?? '');
  unmount();
  return active;
}

describe('NavLinks', () => {
  beforeEach(() => {
    navigationState.pathname = '/';
  });

  it('메뉴 5개를 순서대로, 기획서 §2의 주소로 보여준다', () => {
    render(<NavLinks />);

    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(MENUS.map((menu) => menu.name));
    expect(links.map((link) => link.getAttribute('href'))).toEqual(MENUS.map((menu) => menu.href));
  });

  it('/ 에서는 Home만 활성이다', () => {
    expect(activeMenuNames('/')).toEqual(['Home']);
  });

  it('/blog/x 에서는 Blog만 활성이다 (경로 접두어 일치, Home은 아님)', () => {
    expect(activeMenuNames('/blog/x')).toEqual(['Blog']);
  });

  it('/projects 에서는 Projects만 활성이다', () => {
    expect(activeMenuNames('/projects')).toEqual(['Projects']);
  });

  it('/about 에서는 About만 활성이고 Contact(/about#contact)는 활성 표시를 하지 않는다', () => {
    expect(activeMenuNames('/about')).toEqual(['About']);
  });

  it('메뉴에 없는 경로에서는 활성 메뉴가 없다', () => {
    expect(activeMenuNames('/search')).toEqual([]);
  });

  it('경로 접두어는 경로 단위로 일치한다 (/blogger는 Blog가 아니다)', () => {
    expect(activeMenuNames('/blogger')).toEqual([]);
  });
});
