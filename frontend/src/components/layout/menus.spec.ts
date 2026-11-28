import { describe, expect, it } from 'vitest';
import { MENUS, RSS_HREF } from './menus';

/**
 * M2-09 ① 단계: 메뉴별 prefetch 값 (#43 복원). `menus.ts`의 전역 `PREFETCH = false`를 없애고
 * 메뉴(`Menu`)마다 `prefetch: boolean`을 갖게 한다. 페이지가 있는 `/blog`만 true, 아직 없는 `/projects`·`/about`·`/about#contact`는 false(M4에서 복원).
 */

// 구현 전에도 컴파일되도록 `prefetch` 속성을 느슨한 타입으로 읽는다.
const prefetchOf = (href: string): unknown =>
  (MENUS.find((menu) => menu.href === href) as Record<string, unknown> | undefined)?.prefetch;

describe('메뉴별 prefetch', () => {
  it('/blog는 prefetch한다', () => {
    expect(prefetchOf('/blog')).toBe(true);
  });

  it.each(['/projects', '/about', '/about#contact'])(
    '아직 페이지가 없는 %s는 prefetch하지 않는다',
    (href) => {
      expect(prefetchOf(href)).toBe(false);
    },
  );

  it('모든 메뉴가 prefetch 값을 true/false로 명시한다(전역 값에 기대지 않는다)', () => {
    for (const menu of MENUS) {
      expect(typeof (menu as Record<string, unknown>).prefetch, menu.href).toBe('boolean');
    }
  });

  it('전역 PREFETCH 상수는 더 이상 내보내지 않는다', async () => {
    const menus = (await import('./menus')) as Record<string, unknown>;
    expect('PREFETCH' in menus).toBe(false);
  });

  it('RSS는 메뉴가 아니라 일반 링크 주소다', () => {
    expect(RSS_HREF).toBe('/feed.xml');
    expect(MENUS.some((menu) => menu.href === RSS_HREF)).toBe(false);
  });
});
