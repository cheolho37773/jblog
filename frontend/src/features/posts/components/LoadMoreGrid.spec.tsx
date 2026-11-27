import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentType } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makePost, type PostSummaryDto } from './post-card.test-data';

/**
 * M2-07 ① 단계: LoadMoreGrid 계약 (구현 전 작성, 동적 import).
 * 브라우저 요청은 `browserApi.GET('/api/posts', { params: { query } })`로 보낸다고 본다(지시서 "동작 규칙").
 * jsdom에서는 상대 URL fetch(Request)가 동작하지 않아 `@/lib/api/client`의 browserApi를 목으로 바꾼다.
 */

const getMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/client', () => ({ browserApi: { GET: getMock } }));

type Filter = { category?: string } | { tag?: string };
interface GridProps {
  initialPosts: PostSummaryDto[];
  initialPage: number;
  totalPages: number;
  filter: Filter;
}

const LIST_LABEL = '글 목록';
const FAILURE_TEXT = '글을 더 불러오지 못했습니다. 다시 시도해 주세요.';

const post = (slug: string) => makePost({ slug, title: `제목 ${slug}` });
const posts = (...slugs: string[]) => slugs.map(post);

const pageOf = (items: PostSummaryDto[], page: number, totalPages: number) => ({
  data: { items, page, size: 9, totalItems: items.length, totalPages },
  response: { ok: true, status: 200 },
});
const serverError = () => ({ error: { statusCode: 500 }, response: { ok: false, status: 500 } });

async function renderGrid(overrides: Partial<GridProps> = {}) {
  const path = './LoadMoreGrid';
  const { LoadMoreGrid } = (await import(/* @vite-ignore */ path)) as {
    LoadMoreGrid: ComponentType<GridProps>;
  };
  const props: GridProps = {
    initialPosts: posts('a', 'b'),
    initialPage: 1,
    totalPages: 2,
    filter: {},
    ...overrides,
  };
  return render(<LoadMoreGrid {...props} />);
}

const loadMoreButton = () => screen.queryByRole('button', { name: /Load More/ });
const list = () => screen.getByRole('list', { name: LIST_LABEL });
const cardLinks = () => within(list()).getAllByRole('link');
const slugsInList = () => cardLinks().map((a) => a.getAttribute('href')?.replace('/blog/', ''));
const lastQuery = () => getMock.mock.calls.at(-1)?.[1]?.params?.query as Record<string, unknown>;

beforeEach(() => {
  getMock.mockReset();
  window.history.replaceState(null, '', '/blog');
});

describe('LoadMoreGrid: 처음 모습', () => {
  it('글 목록 ul(aria-label="글 목록") 안에 글마다 li 하나가 있다', async () => {
    await renderGrid({ initialPosts: posts('a', 'b', 'c') });
    expect(within(list()).getAllByRole('listitem')).toHaveLength(3);
    expect(slugsInList()).toEqual(['a', 'b', 'c']);
  });

  it('다음 페이지가 있으면 "Load More" 버튼이 있다', async () => {
    await renderGrid({ initialPage: 1, totalPages: 2 });
    expect(screen.getByRole('button', { name: 'Load More' })).toBeEnabled();
  });

  it('마지막 페이지면 버튼을 그리지 않는다', async () => {
    await renderGrid({ initialPage: 2, totalPages: 2 });
    expect(loadMoreButton()).toBeNull();
  });

  it('totalPages가 1이어도 버튼이 없다', async () => {
    await renderGrid({ initialPage: 1, totalPages: 1 });
    expect(loadMoreButton()).toBeNull();
  });

  it('카드 제목은 h3이다(Overlay가 h2)', async () => {
    await renderGrid();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2);
  });

  it('처음에는 오류 알림이 없다', async () => {
    await renderGrid();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('LoadMoreGrid: 불러오기', () => {
  it('다음 페이지를 /api/posts?page=2&size=9 로 요청한다', async () => {
    getMock.mockResolvedValue(pageOf(posts('c'), 2, 2));
    await renderGrid();
    await userEvent.click(screen.getByRole('button', { name: 'Load More' }));
    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(1));
    expect(getMock.mock.calls[0]?.[0]).toBe('/api/posts');
    expect(lastQuery()).toMatchObject({ page: 2, size: 9 });
  });

  it('현재 페이지가 2면 3페이지를 요청한다(?page=2 새로고침 뒤 이어서)', async () => {
    getMock.mockResolvedValue(pageOf(posts('z'), 3, 3));
    await renderGrid({ initialPage: 2, totalPages: 3 });
    await userEvent.click(screen.getByRole('button', { name: 'Load More' }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ page: 3 }));
  });

  it('category 필터면 같은 category를 붙여 요청한다(tag는 붙이지 않는다)', async () => {
    getMock.mockResolvedValue(pageOf(posts('c'), 2, 2));
    await renderGrid({ filter: { category: 'backend' } });
    await userEvent.click(screen.getByRole('button', { name: 'Load More' }));
    await waitFor(() => expect(getMock).toHaveBeenCalled());
    expect(lastQuery()).toMatchObject({ page: 2, size: 9, category: 'backend' });
    expect(lastQuery()).not.toHaveProperty('tag');
  });

  it('tag 필터면 같은 tag를 붙여 요청한다(category는 붙이지 않는다)', async () => {
    getMock.mockResolvedValue(pageOf(posts('c'), 2, 2));
    await renderGrid({ filter: { tag: 'nextjs' } });
    await userEvent.click(screen.getByRole('button', { name: 'Load More' }));
    await waitFor(() => expect(getMock).toHaveBeenCalled());
    expect(lastQuery()).toMatchObject({ page: 2, size: 9, tag: 'nextjs' });
    expect(lastQuery()).not.toHaveProperty('category');
  });

  it('받은 글을 기존 카드 뒤에 붙인다', async () => {
    getMock.mockResolvedValue(pageOf(posts('c', 'd'), 2, 2));
    await renderGrid();
    await userEvent.click(screen.getByRole('button', { name: 'Load More' }));
    await waitFor(() => expect(cardLinks()).toHaveLength(4));
    expect(slugsInList()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('이미 있는 slug는 붙이지 않는다(중복 제거, 앞의 것을 남긴다)', async () => {
    getMock.mockResolvedValue(pageOf(posts('b', 'c'), 2, 2));
    await renderGrid();
    await userEvent.click(screen.getByRole('button', { name: 'Load More' }));
    await waitFor(() => expect(cardLinks()).toHaveLength(3));
    expect(slugsInList()).toEqual(['a', 'b', 'c']);
  });

  it('성공하면 aria-live="polite" 영역에 "글 n개를 더 불러왔습니다."가 나온다', async () => {
    getMock.mockResolvedValue(pageOf(posts('c', 'd'), 2, 2));
    const { container } = await renderGrid();
    await userEvent.click(screen.getByRole('button', { name: 'Load More' }));
    await waitFor(() => expect(cardLinks()).toHaveLength(4));
    const live = container.querySelector('[aria-live="polite"]');
    expect(live).not.toBeNull();
    expect(live).toHaveTextContent('글 2개를 더 불러왔습니다.');
  });

  it('마지막 페이지에 도달하면 버튼이 사라진다', async () => {
    getMock.mockResolvedValue(pageOf(posts('c'), 2, 2));
    await renderGrid({ totalPages: 2 });
    await userEvent.click(screen.getByRole('button', { name: 'Load More' }));
    await waitFor(() => expect(loadMoreButton()).toBeNull());
  });

  it('아직 다음 페이지가 남아 있으면 버튼이 남고 다시 누르면 그다음 페이지를 요청한다', async () => {
    getMock
      .mockResolvedValueOnce(pageOf(posts('c'), 2, 3))
      .mockResolvedValueOnce(pageOf(posts('d'), 3, 3));
    await renderGrid({ totalPages: 3 });
    await userEvent.click(screen.getByRole('button', { name: 'Load More' }));
    await waitFor(() => expect(cardLinks()).toHaveLength(3));
    expect(loadMoreButton()).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Load More' }));
    await waitFor(() => expect(cardLinks()).toHaveLength(4));
    expect(getMock.mock.calls[1]?.[1]?.params?.query).toMatchObject({ page: 3 });
    expect(loadMoreButton()).toBeNull();
  });
});

describe('LoadMoreGrid: 주소(replaceState)', () => {
  it('성공하면 ?page=를 현재 페이지로 갱신한다', async () => {
    getMock.mockResolvedValue(pageOf(posts('c'), 2, 2));
    const push = vi.spyOn(window.history, 'pushState');
    await renderGrid();
    await userEvent.click(screen.getByRole('button', { name: 'Load More' }));
    await waitFor(() => expect(new URLSearchParams(window.location.search).get('page')).toBe('2'));
    expect(push).not.toHaveBeenCalled();
  });

  it('다른 쿼리(category·알 수 없는 키)는 그대로 유지한다', async () => {
    window.history.replaceState(null, '', '/blog?category=backend&foo=bar');
    getMock.mockResolvedValue(pageOf(posts('c'), 2, 2));
    await renderGrid({ filter: { category: 'backend' } });
    await userEvent.click(screen.getByRole('button', { name: 'Load More' }));
    await waitFor(() => expect(new URLSearchParams(window.location.search).get('page')).toBe('2'));
    const params = new URLSearchParams(window.location.search);
    expect(params.get('category')).toBe('backend');
    expect(params.get('foo')).toBe('bar');
    expect(window.location.pathname).toBe('/blog');
  });

  it('이미 ?page=2가 있으면 3으로 바꾼다(page 키가 두 번 생기지 않는다)', async () => {
    window.history.replaceState(null, '', '/blog?page=2');
    getMock.mockResolvedValue(pageOf(posts('z'), 3, 3));
    await renderGrid({ initialPage: 2, totalPages: 3 });
    await userEvent.click(screen.getByRole('button', { name: 'Load More' }));
    await waitFor(() => expect(new URLSearchParams(window.location.search).get('page')).toBe('3'));
    expect(new URLSearchParams(window.location.search).getAll('page')).toEqual(['3']);
  });

  it('실패하면 주소를 바꾸지 않는다', async () => {
    getMock.mockResolvedValue(serverError());
    await renderGrid();
    await userEvent.click(screen.getByRole('button', { name: 'Load More' }));
    await screen.findByRole('alert');
    expect(window.location.search).toBe('');
  });
});

describe('LoadMoreGrid: 진행 중', () => {
  it('요청 중에는 버튼이 disabled이고 aria-busy="true"이며, 두 번 눌러도 요청은 1번이다', async () => {
    let resolve!: (value: ReturnType<typeof pageOf>) => void;
    getMock.mockReturnValue(new Promise((r) => (resolve = r)));
    await renderGrid();
    const button = screen.getByRole('button', { name: /Load More/ });

    await userEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    await userEvent.click(button);
    expect(getMock).toHaveBeenCalledTimes(1);

    resolve(pageOf(posts('c'), 2, 2));
    await waitFor(() => expect(cardLinks()).toHaveLength(3));
  });

  it('끝나면 버튼이 다시 활성화되고 aria-busy가 풀린다(다음 페이지가 남은 경우)', async () => {
    getMock.mockResolvedValue(pageOf(posts('c'), 2, 3));
    await renderGrid({ totalPages: 3 });
    await userEvent.click(screen.getByRole('button', { name: /Load More/ }));
    await waitFor(() => expect(cardLinks()).toHaveLength(3));
    const button = screen.getByRole('button', { name: /Load More/ });
    expect(button).toBeEnabled();
    expect(button).not.toHaveAttribute('aria-busy', 'true');
  });
});

describe('LoadMoreGrid: 실패', () => {
  it('응답이 500이면 기존 카드를 그대로 두고 role="alert" 오류 문구를 버튼 위에 보인다', async () => {
    getMock.mockResolvedValue(serverError());
    await renderGrid();
    await userEvent.click(screen.getByRole('button', { name: /Load More/ }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(FAILURE_TEXT);
    expect(slugsInList()).toEqual(['a', 'b']);
    const button = screen.getByRole('button', { name: /Load More/ });
    expect(button).toBeEnabled();
    expect(button).not.toHaveAttribute('aria-busy', 'true');
    // 오류 문구가 버튼보다 앞(위)에 있다
    expect(alert.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('네트워크 오류(요청이 예외로 끝남)도 같은 오류 문구를 보인다', async () => {
    getMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await renderGrid();
    await userEvent.click(screen.getByRole('button', { name: /Load More/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(FAILURE_TEXT);
    expect(slugsInList()).toEqual(['a', 'b']);
  });

  it('실패 뒤 다시 누르면 같은 페이지(2)를 다시 요청하고 성공하면 오류 문구가 사라진다', async () => {
    getMock.mockResolvedValueOnce(serverError()).mockResolvedValueOnce(pageOf(posts('c'), 2, 2));
    await renderGrid();
    await userEvent.click(screen.getByRole('button', { name: /Load More/ }));
    await screen.findByRole('alert');

    await userEvent.click(screen.getByRole('button', { name: /Load More/ }));
    await waitFor(() => expect(cardLinks()).toHaveLength(3));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(getMock).toHaveBeenCalledTimes(2);
    expect(getMock.mock.calls[1]?.[1]?.params?.query).toMatchObject({ page: 2 });
  });
});

describe('LoadMoreGrid: 포커스', () => {
  it('버튼이 남아 있으면 포커스는 버튼에 그대로 둔다', async () => {
    getMock.mockResolvedValue(pageOf(posts('c'), 2, 3));
    await renderGrid({ totalPages: 3 });
    await userEvent.click(screen.getByRole('button', { name: /Load More/ }));
    await waitFor(() => expect(cardLinks()).toHaveLength(3));
    expect(screen.getByRole('button', { name: /Load More/ })).toHaveFocus();
  });

  it('버튼이 사라지면 새로 붙은 첫 카드 링크로 포커스를 옮긴다', async () => {
    getMock.mockResolvedValue(pageOf(posts('c', 'd'), 2, 2));
    await renderGrid();
    await userEvent.click(screen.getByRole('button', { name: /Load More/ }));
    await waitFor(() => expect(loadMoreButton()).toBeNull());
    await waitFor(() => expect(screen.getByRole('link', { name: '제목 c' })).toHaveFocus());
  });
});

// Codex r2 대응 구조: 서버 렌더 한 번 = 목록 상태 한 벌. 페이지가 서버 렌더마다 만드는 렌더 식별자를 LoadMoreGrid의 React `key`로 넣는다.
// 키가 바뀌면(이동·새로고침·같은 주소 재요청으로 서버가 다시 그림) 새 서버 값으로 새로 시작하고, 키가 같으면 다시 그려도 불러온 카드를 유지한다.
// 값 비교(slug 순서 등)나 주소(useSearchParams) 비교로 상태를 버리지 않는다.
describe('LoadMoreGrid: 서버 렌더 식별자(key)', () => {
  async function renderKeyed(first: Partial<GridProps> = {}, firstKey = 'render-1') {
    const path = './LoadMoreGrid';
    const { LoadMoreGrid } = (await import(/* @vite-ignore */ path)) as {
      LoadMoreGrid: ComponentType<GridProps>;
    };
    const base: GridProps = {
      initialPosts: posts('a', 'b'),
      initialPage: 1,
      totalPages: 2,
      filter: {},
    };
    const view = render(<LoadMoreGrid key={firstKey} {...base} {...first} />);
    return {
      rerender: (next: Partial<GridProps>, key: string) =>
        view.rerender(<LoadMoreGrid key={key} {...base} {...next} />),
      unmount: view.unmount,
    };
  }

  it('키가 바뀌면 Load More로 늘어난 뒤에도 서버가 준 처음 목록·버튼으로 돌아간다 (13개 → Navbar Blog → /blog)', async () => {
    getMock.mockResolvedValue(pageOf(posts('c', 'd'), 2, 2));
    const view = await renderKeyed();
    await userEvent.click(screen.getByRole('button', { name: /Load More/ }));
    await waitFor(() => expect(slugsInList()).toEqual(['a', 'b', 'c', 'd']));

    // 서버 값이 처음과 똑같아도 서버가 다시 그렸다면(새 키) 새로 시작한다.
    view.rerender({ initialPosts: posts('a', 'b'), initialPage: 1, totalPages: 2 }, 'render-2');

    await waitFor(() => expect(slugsInList()).toEqual(['a', 'b']));
    expect(loadMoreButton()).not.toBeNull();
  });

  it('키가 같으면 같은 서버 props로 다시 그려도 불러온 카드를 유지한다(Load More 자신의 주소 변경은 상태를 버리지 않는다)', async () => {
    getMock.mockResolvedValue(pageOf(posts('c', 'd'), 2, 2));
    const view = await renderKeyed();
    await userEvent.click(screen.getByRole('button', { name: /Load More/ }));
    await waitFor(() => expect(slugsInList()).toEqual(['a', 'b', 'c', 'd']));

    view.rerender({ initialPosts: posts('a', 'b'), initialPage: 1, totalPages: 2 }, 'render-1');

    expect(slugsInList()).toEqual(['a', 'b', 'c', 'd']);
    expect(loadMoreButton()).toBeNull();
    expect(window.location.search).toBe('?page=2');
  });

  it('같은 slug의 제목이 바뀐 서버 값이 새 키로 오면 새 제목이 보인다 (글 수정 후 같은 주소로 이동)', async () => {
    const view = await renderKeyed({
      initialPosts: [makePost({ slug: 'a', title: 'Before' }), post('b')],
    });
    expect(screen.getByRole('link', { name: 'Before' })).toBeInTheDocument();

    view.rerender(
      { initialPosts: [makePost({ slug: 'a', title: 'After' }), post('b')] },
      'render-2',
    );

    expect(await screen.findByRole('link', { name: 'After' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Before' })).not.toBeInTheDocument();
  });

  it('새 키로 2페이지까지 그린 props(initialPage 2)가 오면 그 목록을 보여 주고 버튼이 없다 (/blog → /blog?page=2)', async () => {
    const view = await renderKeyed();
    expect(loadMoreButton()).not.toBeNull();

    view.rerender(
      { initialPosts: posts('a', 'b', 'c', 'd'), initialPage: 2, totalPages: 2 },
      'render-2',
    );

    await waitFor(() => expect(slugsInList()).toEqual(['a', 'b', 'c', 'd']));
    expect(loadMoreButton()).toBeNull();
  });

  it('새 키 뒤의 Load More는 새 initialPage 다음 페이지를 요청한다', async () => {
    getMock.mockResolvedValue(pageOf(posts('e'), 3, 3));
    const view = await renderKeyed();

    view.rerender(
      { initialPosts: posts('a', 'b', 'c', 'd'), initialPage: 2, totalPages: 3 },
      'render-2',
    );
    await userEvent.click(await screen.findByRole('button', { name: /Load More/ }));

    await waitFor(() => expect(slugsInList()).toEqual(['a', 'b', 'c', 'd', 'e']));
    expect(lastQuery().page).toBe(3);
  });
});

// 진행 중 요청은 컴포넌트가 사라질 때(새 키·언마운트) 취소한다. 취소된 응답은 목록·주소·안내를 바꾸지 않는다.
describe('LoadMoreGrid: 사라질 때 진행 중 요청 취소', () => {
  const signalOfLastCall = () =>
    (getMock.mock.calls.at(-1)?.[1] as { signal?: AbortSignal } | undefined)?.signal;

  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => (resolve = done));
    return { promise, resolve };
  }

  async function renderKeyed() {
    const path = './LoadMoreGrid';
    const { LoadMoreGrid } = (await import(/* @vite-ignore */ path)) as {
      LoadMoreGrid: ComponentType<GridProps>;
    };
    const props: GridProps = {
      initialPosts: posts('a', 'b'),
      initialPage: 1,
      totalPages: 2,
      filter: {},
    };
    const view = render(<LoadMoreGrid key="render-1" {...props} />);
    return {
      rerenderWithKey: (key: string) => view.rerender(<LoadMoreGrid key={key} {...props} />),
      unmount: view.unmount,
    };
  }

  it('요청은 두 번째 인자의 signal(AbortSignal)을 함께 보낸다', async () => {
    const pending = deferred<ReturnType<typeof pageOf>>();
    getMock.mockReturnValue(pending.promise);
    await renderKeyed();
    await userEvent.click(screen.getByRole('button', { name: /Load More/ }));

    expect(signalOfLastCall()).toBeInstanceOf(AbortSignal);
    expect(signalOfLastCall()?.aborted).toBe(false);
    pending.resolve(pageOf(posts('c'), 2, 2));
  });

  it('언마운트하면 진행 중 요청을 취소하고, 늦게 온 응답은 주소를 바꾸지 않는다', async () => {
    const pending = deferred<ReturnType<typeof pageOf>>();
    getMock.mockReturnValue(pending.promise);
    const view = await renderKeyed();
    await userEvent.click(screen.getByRole('button', { name: /Load More/ }));
    const signal = signalOfLastCall();

    view.unmount();
    expect(signal?.aborted).toBe(true);
    pending.resolve(pageOf(posts('c', 'd'), 2, 2));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(window.location.search).toBe('');
  });

  it('새 키로 바뀌면 진행 중 요청을 취소하고, 늦은 응답이 새 목록·주소를 바꾸지 않으며, 새 Load More가 동작한다', async () => {
    const stale = deferred<ReturnType<typeof pageOf>>();
    getMock.mockReturnValueOnce(stale.promise);
    const view = await renderKeyed();
    await userEvent.click(screen.getByRole('button', { name: /Load More/ }));
    const staleSignal = signalOfLastCall();

    view.rerenderWithKey('render-2');
    expect(staleSignal?.aborted).toBe(true);
    stale.resolve(pageOf(posts('late'), 2, 2));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(slugsInList()).toEqual(['a', 'b']);
    expect(window.location.search).toBe('');

    // 새 상태의 버튼은 눌려 있지 않고(요청 중 아님) 새 요청이 보내진다.
    getMock.mockResolvedValueOnce(pageOf(posts('c'), 2, 2));
    const button = screen.getByRole('button', { name: /Load More/ });
    expect(button).toBeEnabled();
    await userEvent.click(button);
    await waitFor(() => expect(slugsInList()).toEqual(['a', 'b', 'c']));
    expect(signalOfLastCall()?.aborted).toBe(false);
    expect(window.location.search).toBe('?page=2');
  });
});

// Codex r1 대응: 성공 안내는 중복 제거 후 실제로 붙은 카드 수를 말한다.
// 기대값(지시서에 없어 정한 기본값): 0개가 붙으면 "0개를 더 불러왔습니다"라고 하지 않고 안내를 생략(빈 문자열)한다.
describe('LoadMoreGrid: 성공 안내 개수 = 실제로 붙은 카드 수', () => {
  const liveRegion = (container: HTMLElement) =>
    container.querySelector('[aria-live="polite"]') as HTMLElement;

  it('응답 [b, c]가 기존 [a, b]와 겹치면 카드는 1개 늘고 안내도 "글 1개"다', async () => {
    getMock.mockResolvedValue(pageOf(posts('b', 'c'), 2, 2));
    const { container } = await renderGrid({ initialPosts: posts('a', 'b') });
    await userEvent.click(screen.getByRole('button', { name: /Load More/ }));

    await waitFor(() => expect(slugsInList()).toEqual(['a', 'b', 'c']));
    expect(liveRegion(container)).toHaveTextContent('글 1개를 더 불러왔습니다.');
    expect(liveRegion(container)).not.toHaveTextContent('글 2개');
  });

  it('응답이 전부 중복이라 0개가 붙으면 "0개"를 말하지 않고 안내를 비운다(카드·주소 진행은 그대로)', async () => {
    getMock.mockResolvedValue(pageOf(posts('a', 'b'), 2, 3));
    const { container } = await renderGrid({ initialPosts: posts('a', 'b'), totalPages: 3 });
    await userEvent.click(screen.getByRole('button', { name: /Load More/ }));

    await waitFor(() => expect(window.location.search).toBe('?page=2'));
    expect(slugsInList()).toEqual(['a', 'b']);
    expect(liveRegion(container)).not.toHaveTextContent('0개');
    expect(liveRegion(container)).toBeEmptyDOMElement();
  });

  it('앞선 성공 안내가 남아 있어도 다음 요청이 0개면 이전 안내를 지운다', async () => {
    getMock
      .mockResolvedValueOnce(pageOf(posts('c', 'd'), 2, 3))
      .mockResolvedValueOnce(pageOf(posts('c', 'd'), 3, 3));
    const { container } = await renderGrid({ initialPosts: posts('a', 'b'), totalPages: 3 });
    await userEvent.click(screen.getByRole('button', { name: /Load More/ }));
    await waitFor(() => expect(liveRegion(container)).toHaveTextContent('글 2개'));
    await userEvent.click(screen.getByRole('button', { name: /Load More/ }));

    await waitFor(() => expect(window.location.search).toBe('?page=3'));
    expect(liveRegion(container)).toBeEmptyDOMElement();
  });
});
