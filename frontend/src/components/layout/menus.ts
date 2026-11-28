// 사이트 메뉴 (UI §2). Navbar·모바일 메뉴·Footer Quick Link가 함께 쓴다.
// match: 현재 경로와 어떻게 비교해 활성 표시를 할지. Contact는 같은 페이지의 앵커라 표시하지 않는다.
export type MenuMatch = 'exact' | 'prefix' | 'none';

// prefetch: 페이지가 아직 없는 메뉴는 미리 불러오기가 404 요청을 내므로 false. 페이지가 생기는 M4에서 true로 바꾼다.
export type Menu = { label: string; href: string; match: MenuMatch; prefetch: boolean };

export const MENUS: readonly Menu[] = [
  { label: 'Home', href: '/', prefetch: true, match: 'exact' },
  { label: 'Blog', href: '/blog', prefetch: true, match: 'prefix' },
  { label: 'Projects', href: '/projects', prefetch: false, match: 'prefix' },
  { label: 'About', href: '/about', prefetch: false, match: 'prefix' },
  { label: 'Contact', href: '/about#contact', prefetch: false, match: 'none' },
];

export const RSS_HREF = '/feed.xml';
