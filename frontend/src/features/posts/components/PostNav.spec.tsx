import { render, screen, within } from '@testing-library/react';
import type { ComponentType } from 'react';
import { describe, expect, it } from 'vitest';

/**
 * M2-08 ① 단계: 이전/다음 글 카드 (UI §7.3, 지시서 "화면 구성" 7). 구현 전 작성, 동적 import.
 * 가정: `./PostNav`의 이름 있는 export `PostNav`. `nav[aria-label="이전·다음 글"]`, 카드 전체가 `/blog/{slug}` 링크,
 * 링크 이름에 라벨(`이전 글`·`다음 글`)과 제목이 들어간다. prev(더 오래된 글)가 DOM에서 먼저다.
 * 둘 다 null이면 아무것도 그리지 않는다. 한쪽만 있을 때 칸 위치 유지는 E2E에서 측정한다.
 */

type Link = { slug: string; title: string };
type Props = { prev: Link | null; next: Link | null };
const load = async () => {
  const path = './PostNav';
  return ((await import(/* @vite-ignore */ path)) as { PostNav: ComponentType<Props> }).PostNav;
};

const PREV = { slug: 'older-post', title: '더 오래된 글 제목' };
const NEXT = { slug: 'newer-post', title: '더 최근 글 제목' };

async function renderNav(props: Props) {
  const PostNav = await load();
  return render(<PostNav {...props} />);
}

describe('PostNav', () => {
  it('nav[aria-label="이전·다음 글"] 안에 prev(이전 글)가 먼저, next(다음 글)가 나중에 온다', async () => {
    await renderNav({ prev: PREV, next: NEXT });
    const nav = screen.getByRole('navigation', { name: '이전·다음 글' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/blog/older-post',
      '/blog/newer-post',
    ]);
  });

  it('링크 이름은 라벨과 제목을 함께 담는다', async () => {
    await renderNav({ prev: PREV, next: NEXT });
    const prev = screen.getByRole('link', { name: /이전 글/ });
    const next = screen.getByRole('link', { name: /다음 글/ });
    expect(prev).toHaveTextContent(PREV.title);
    expect(prev).toHaveAttribute('href', '/blog/older-post');
    expect(next).toHaveTextContent(NEXT.title);
    expect(next).toHaveAttribute('href', '/blog/newer-post');
  });

  it('prev만 있으면 이전 글 링크 하나만 있다', async () => {
    await renderNav({ prev: PREV, next: null });
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: /이전 글/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /다음 글/ })).toBeNull();
  });

  it('next만 있으면 다음 글 링크 하나만 있다', async () => {
    await renderNav({ prev: null, next: NEXT });
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: /다음 글/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /이전 글/ })).toBeNull();
  });

  it('둘 다 null이면 아무것도 그리지 않는다', async () => {
    const { container } = await renderNav({ prev: null, next: null });
    expect(container).toBeEmptyDOMElement();
  });
});
