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
function replacePageInUrl(page: number) {
  const url = new URL(window.location.href);
  url.searchParams.set('page', String(page));
  window.history.replaceState(window.history.state, '', url);
}

async function fetchPage(page: number, filter: LoadMoreGridProps['filter']) {
  const { data: postPage } = await browserApi.GET('/api/posts', {
    params: { query: { page, size: PAGE_SIZE, ...filter } },
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

  const hasMore = page < totalPages;

  useEffect(() => {
    const focusSlug = pendingFocusSlug.current;
    if (!focusSlug) return;
    pendingFocusSlug.current = null;
    const links = listRef.current?.querySelectorAll<HTMLAnchorElement>('a') ?? [];
    const target = Array.from(links).find((a) => a.getAttribute('href') === `/blog/${focusSlug}`);
    target?.focus();
  }, [posts]);

  async function loadMore() {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setIsLoading(true);
    setFailed(false);

    const nextPage = page + 1;
    try {
      const result = await fetchPage(nextPage, filter);
      if (!result) {
        setFailed(true);
        return;
      }
      const merged = mergePostsBySlug(posts, result.items);
      const added = merged.slice(posts.length);
      if (nextPage >= totalPages && added[0]) pendingFocusSlug.current = added[0].slug;
      setPosts(merged);
      setPage(nextPage);
      setAnnouncement(`글 ${result.items.length}개를 더 불러왔습니다.`);
      replacePageInUrl(nextPage);
    } catch {
      setFailed(true);
    } finally {
      requestInFlight.current = false;
      setIsLoading(false);
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
