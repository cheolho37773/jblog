'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { components } from '@/generated/api-types';
import { browserApi } from '@/lib/api/client';
import { mergePostsBySlug } from '../lib/merge-posts';
import { POST_GRID_CLASS } from './post-grid-class';
import { PostCardGrid } from './PostCardGrid';

type PostSummaryDto = components['schemas']['PostSummaryDto'];

type LoadMoreGridProps = {
  initialPosts: PostSummaryDto[];
  initialPage: number;
  totalPages: number;
  filter: { category?: string } | { tag?: string };
};

const PAGE_SIZE = 9;
// 한 행의 카드 높이를 맞추려고 li 안의 article과 링크를 li 높이까지 늘인다. 카드 컴포넌트는 고치지 않는다(다른 화면에 영향).
const FILL_ROW_CLASS = '[&>article]:h-full [&>article>a]:h-full';
const FAILURE_MESSAGE = '글을 더 불러오지 못했습니다. 다시 시도해 주세요.';

// 성공하면 주소의 ?page=만 바꾼다(다른 쿼리 유지). 새로고침하면 서버가 그 페이지까지 다시 그린다.
// Next는 history.replaceState를 라우터에 반영한다(공식 방식). 상태 인자는 null로 넘긴다: 기존 history.state를 그대로 넘기면 Next가 자기 상태로 보고 무시한다.
function replacePageInUrl(page: number) {
  const url = new URL(window.location.href);
  url.searchParams.set('page', String(page));
  window.history.replaceState(null, '', url);
}

async function fetchPage(page: number, filter: LoadMoreGridProps['filter'], signal: AbortSignal) {
  const { data: postPage } = await browserApi.GET('/api/posts', {
    params: { query: { page, size: PAGE_SIZE, ...filter } },
    signal,
  });
  return postPage ?? null;
}

/** 글 카드 격자와 Load More. 첫 페이지(들)는 서버가 그리고 이후 페이지만 브라우저가 `/api/posts`로 받는다. */
export function LoadMoreGrid({ initialPosts, initialPage, totalPages, filter }: LoadMoreGridProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [page, setPage] = useState(initialPage);
  const [isLoading, setIsLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  // 버튼이 사라질 때 포커스를 받을 카드(새로 붙은 첫 글). 렌더에 쓰이지 않아 ref에 둔다
  const pendingFocusSlug = useRef<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // state는 다음 렌더에야 반영되므로 연속 클릭을 막는 데는 ref를 쓴다
  const requestInFlight = useRef(false);
  // 컴포넌트가 사라질 때(이동·새 서버 렌더) 진행 중 요청을 취소해, 늦게 온 응답이 다른 목록·주소를 바꾸지 못하게 한다.
  // Strict Mode가 effect를 두 번 돌려도 매번 새 컨트롤러를 만든다
  const abortController = useRef<AbortController | null>(null);

  const hasMore = page < totalPages;

  useEffect(() => {
    abortController.current = new AbortController();
    return () => abortController.current?.abort();
  }, []);

  // posts가 바뀐 직후에만 실행되고, 사라진 뒤에는 실행되지 않는다(언마운트하면 effect가 돌지 않는다)
  useEffect(() => {
    const focusSlug = pendingFocusSlug.current;
    if (!focusSlug) return;
    pendingFocusSlug.current = null;
    const links = listRef.current?.querySelectorAll<HTMLAnchorElement>('a') ?? [];
    const target = Array.from(links).find((a) => a.getAttribute('href') === `/blog/${focusSlug}`);
    target?.focus();
  }, [posts]);

  // 응답을 목록·페이지·안내·주소에 반영한다
  function showLoadedPage(nextPage: number, loaded: PostSummaryDto[]) {
    const merged = mergePostsBySlug(posts, loaded);
    const added = merged.slice(posts.length);
    if (nextPage >= totalPages && added[0]) pendingFocusSlug.current = added[0].slug;
    setPosts(merged);
    setPage(nextPage);
    // 중복을 뺀 실제 추가 개수를 알린다. 0개면 이전 안내까지 비운다
    setAnnouncement(added.length > 0 ? `글 ${added.length}개를 더 불러왔습니다.` : '');
    replacePageInUrl(nextPage);
  }

  async function loadMore() {
    const signal = abortController.current?.signal;
    if (requestInFlight.current || !signal) return;
    requestInFlight.current = true;
    setIsLoading(true);
    setFailed(false);

    const nextPage = page + 1;
    try {
      const result = await fetchPage(nextPage, filter, signal);
      // 취소된 요청(사라진 컴포넌트)의 결과는 어디에도 반영하지 않는다
      if (signal.aborted) return;
      if (result) showLoadedPage(nextPage, result.items);
      else setFailed(true);
    } catch {
      if (!signal.aborted) setFailed(true);
    } finally {
      requestInFlight.current = false;
      if (!signal.aborted) setIsLoading(false);
    }
  }

  return (
    <>
      <ul ref={listRef} aria-label="글 목록" className={POST_GRID_CLASS}>
        {posts.map((post) => (
          <li key={post.slug} className={FILL_ROW_CLASS}>
            <PostCardGrid post={post} headingLevel={3} />
          </li>
        ))}
      </ul>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      {hasMore && (
        <div className="mt-8 flex flex-col items-center gap-4">
          {failed && (
            <p role="alert" className="text-b4 text-strong">
              {FAILURE_MESSAGE}
            </p>
          )}
          <Button variant="outline" disabled={isLoading} aria-busy={isLoading} onClick={loadMore}>
            Load More
          </Button>
        </div>
      )}
    </>
  );
}
