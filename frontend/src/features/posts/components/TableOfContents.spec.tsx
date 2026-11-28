import { render, screen, within } from '@testing-library/react';
import type { ComponentType } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * M2-08 ① 단계: 목차(TOC) 클라이언트 컴포넌트 (지시서 "화면 구성" TOC). 구현 전 작성, 동적 import.
 * 가정: `./TableOfContents`의 이름 있는 export `TableOfContents`, Props `{ headings: Heading[] }`
 * (Heading = { depth: 2 | 3; text: string; id: string }). `nav[aria-label="목차"]`, 각 항목은 `#id` 링크.
 * 헤딩이 없으면 아무것도 그리지 않는다. 현재 항목은 `aria-current="location"`이고 한 번에 하나뿐이다.
 * 스크롤에 따른 변화는 구현 방식(IntersectionObserver·scroll)에 묶이지 않도록 E2E에서 확인한다.
 * jsdom에는 IntersectionObserver가 없어 아무 일도 하지 않는 대역을 넣는다.
 */

type Heading = { depth: 2 | 3; text: string; id: string };
const load = async () => {
  const path = './TableOfContents';
  return (
    (await import(/* @vite-ignore */ path)) as {
      TableOfContents: ComponentType<{ headings: Heading[] }>;
    }
  ).TableOfContents;
};

const HEADINGS: Heading[] = [
  { depth: 2, text: '시작하며', id: 'start' },
  { depth: 3, text: '먼저 알아둘 점', id: 'notes' },
  { depth: 2, text: '정리', id: 'wrap-up' },
];

beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TableOfContents', () => {
  it('nav[aria-label="목차"] 안에 헤딩 순서대로 #id 링크를 그린다', async () => {
    const TableOfContents = await load();
    render(<TableOfContents headings={HEADINGS} />);
    const nav = screen.getByRole('navigation', { name: '목차' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((a) => a.textContent)).toEqual(['시작하며', '먼저 알아둘 점', '정리']);
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['#start', '#notes', '#wrap-up']);
  });

  it('헤딩이 없으면 아무것도 그리지 않는다', async () => {
    const TableOfContents = await load();
    const { container } = render(<TableOfContents headings={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('현재 항목 표시(aria-current)는 "location"이고 한 번에 최대 하나다', async () => {
    const TableOfContents = await load();
    render(<TableOfContents headings={HEADINGS} />);
    const current = screen.getAllByRole('link').filter((a) => a.hasAttribute('aria-current'));
    expect(current.length).toBeLessThanOrEqual(1);
    for (const a of current) expect(a).toHaveAttribute('aria-current', 'location');
  });
});
