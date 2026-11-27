import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoadMoreGridBoundary } from './LoadMoreGridBoundary';
import { makePost, type PostSummaryDto } from './post-card.test-data';

/**
 * M2-07 Codex r2 대응: 목록 상태를 버리는 방법은 `LoadMoreGrid` remount 하나다.
 * 원인 ① 서버가 다시 그림(경계의 key가 바뀜) ② 서버가 다시 그리지 않는 클라이언트 이동 = 주소(`useSearchParams`)가
 * Load More 자신이 만든 값이 아닌 값으로 바뀜. 목은 그릴 때마다 현재 `window.location.search`를 읽어 Next가
 * replaceState·이동을 `useSearchParams`에 반영하는 효과를 낸다.
 */

const getMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/client', () => ({ browserApi: { GET: getMock } }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const post = (slug: string) => makePost({ slug, title: `제목 ${slug}` });
const posts = (...slugs: string[]) => slugs.map(post);
const pageOf = (items: PostSummaryDto[], page: number, totalPages: number) => ({
  data: { items, page, size: 9, totalItems: items.length, totalPages },
  response: { ok: true, status: 200 },
});

const gridProps = {
  initialPosts: posts('a', 'b'),
  initialPage: 1,
  totalPages: 2,
  filter: {},
};

function renderBoundary(serverKey = 'render-1') {
  const view = render(<LoadMoreGridBoundary key={serverKey} {...gridProps} />);
  return {
    // 라우터가 새 주소로 이동한 것처럼: 주소를 바꾸고 다시 그린다(서버 key는 같다)
    navigateTo: (url: string) => {
      window.history.replaceState(null, '', url);
      view.rerender(<LoadMoreGridBoundary key={serverKey} {...gridProps} />);
    },
    renderFromServer: (key: string) =>
      view.rerender(<LoadMoreGridBoundary key={key} {...gridProps} />),
  };
}

const slugs = () =>
  within(screen.getByRole('list', { name: '글 목록' }))
    .getAllByRole('link')
    .map((a) => a.getAttribute('href')?.replace('/blog/', ''));
const loadMoreButton = () => screen.queryByRole('button', { name: /Load More/ });
const loadMore = async () => {
  await userEvent.click(screen.getByRole('button', { name: /Load More/ }));
};
const signalOfLastCall = () =>
  (getMock.mock.calls.at(-1)?.[1] as { signal?: AbortSignal } | undefined)?.signal;

beforeEach(() => {
  getMock.mockReset();
  window.history.replaceState(null, '', '/blog');
});

describe('LoadMoreGridBoundary', () => {
  it('Load More 자신이 바꾼 주소(?page=2)로는 다시 만들지 않아 불러온 카드를 유지한다', async () => {
    getMock.mockResolvedValue(pageOf(posts('c', 'd'), 2, 2));
    renderBoundary();
    await loadMore();
    await waitFor(() => expect(slugs()).toEqual(['a', 'b', 'c', 'd']));

    await waitFor(() => expect(window.location.search).toBe('?page=2'));
    expect(slugs()).toEqual(['a', 'b', 'c', 'd']);
    expect(loadMoreButton()).toBeNull();
  });

  it('Load More가 만든 값이 아닌 주소로 바뀌면 다시 만들어 서버 값(처음 목록·버튼)으로 돌아간다', async () => {
    getMock.mockResolvedValue(pageOf(posts('c', 'd'), 2, 2));
    const view = renderBoundary();
    await loadMore();
    await waitFor(() => expect(slugs()).toEqual(['a', 'b', 'c', 'd']));

    view.navigateTo('/blog?category=frontend');

    await waitFor(() => expect(slugs()).toEqual(['a', 'b']));
    expect(loadMoreButton()).not.toBeNull();
  });

  it('Load More 뒤 처음 주소(/blog)로 돌아와도 다시 만든다 (13개 → Navbar Blog → /blog)', async () => {
    getMock.mockResolvedValue(pageOf(posts('c', 'd'), 2, 2));
    const view = renderBoundary();
    await loadMore();
    await waitFor(() => expect(slugs()).toEqual(['a', 'b', 'c', 'd']));
    expect(window.location.search).toBe('?page=2');

    view.navigateTo('/blog');

    await waitFor(() => expect(slugs()).toEqual(['a', 'b']));
    expect(loadMoreButton()).not.toBeNull();
  });

  it('다시 만든 뒤의 Load More는 정상 동작하고 주소를 다시 ?page=2로 바꾼다', async () => {
    getMock.mockResolvedValue(pageOf(posts('c', 'd'), 2, 2));
    const view = renderBoundary();
    await loadMore();
    await waitFor(() => expect(slugs()).toEqual(['a', 'b', 'c', 'd']));
    view.navigateTo('/blog');
    await waitFor(() => expect(slugs()).toEqual(['a', 'b']));

    await loadMore();

    await waitFor(() => expect(slugs()).toEqual(['a', 'b', 'c', 'd']));
    expect(window.location.search).toBe('?page=2');
  });

  it('주소가 바뀌면 진행 중 Load More 요청을 취소하고, 늦은 응답은 목록·주소를 바꾸지 않으며, 새 Load More가 눌린다', async () => {
    let resolveStale!: (value: ReturnType<typeof pageOf>) => void;
    getMock.mockReturnValueOnce(new Promise((resolve) => (resolveStale = resolve)));
    const view = renderBoundary();
    await loadMore();
    const staleSignal = signalOfLastCall();
    expect(staleSignal?.aborted).toBe(false);

    view.navigateTo('/blog?category=frontend');
    expect(staleSignal?.aborted).toBe(true);
    resolveStale(pageOf(posts('late'), 2, 2));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(slugs()).toEqual(['a', 'b']);
    expect(window.location.search).toBe('?category=frontend');

    getMock.mockResolvedValueOnce(pageOf(posts('c'), 2, 2));
    expect(screen.getByRole('button', { name: /Load More/ })).toBeEnabled();
    await loadMore();
    await waitFor(() => expect(slugs()).toEqual(['a', 'b', 'c']));
  });

  it('서버가 다시 그려 key가 바뀌면 주소가 같아도 다시 만든다', async () => {
    getMock.mockResolvedValue(pageOf(posts('c', 'd'), 2, 2));
    const view = renderBoundary('render-1');
    await loadMore();
    await waitFor(() => expect(slugs()).toEqual(['a', 'b', 'c', 'd']));

    view.renderFromServer('render-2');

    await waitFor(() => expect(slugs()).toEqual(['a', 'b']));
    expect(loadMoreButton()).not.toBeNull();
  });

  it('주소도 key도 그대로 다시 그리면 불러온 카드를 유지한다', async () => {
    getMock.mockResolvedValue(pageOf(posts('c', 'd'), 2, 2));
    const view = renderBoundary();
    await loadMore();
    await waitFor(() => expect(slugs()).toEqual(['a', 'b', 'c', 'd']));

    view.navigateTo('/blog?page=2');

    expect(slugs()).toEqual(['a', 'b', 'c', 'd']);
  });
});
