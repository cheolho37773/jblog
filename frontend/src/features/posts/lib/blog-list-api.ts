import 'server-only';
import { cache } from 'react';
import type { components } from '@/generated/api-types';
import { createServerApi } from '@/lib/api/server';
import { clampPage } from './blog-list-query';
import { mergePostsBySlug } from './merge-posts';

type PostSummaryDto = components['schemas']['PostSummaryDto'];
type PostListResponseDto = components['schemas']['PostListResponseDto'];
type PostFilter = { category?: string; tag?: string };

export const BLOG_PAGE_SIZE = 9;
const FIRST_PAGE = 1;
const CACHE_TAGS = ['posts'];

// 조회 실패는 빈 값으로 바꾸지 않는다. 5xx·네트워크 오류는 createServerApi가 이미 던지고, 그 밖의 실패(4xx)도 여기서 던진다.
function requireData<T>(result: { data?: T }, what: string): T {
  if (result.data === undefined) throw new Error(`${what} 조회 실패`);
  return result.data;
}

// 한 요청 안에서 페이지와 generateMetadata가 같은 목록을 쓰므로 cache로 한 번만 부른다.
export const loadCategories = cache(async () => {
  const result = await createServerApi(CACHE_TAGS).GET('/api/categories');
  return requireData(result, '카테고리');
});

export const loadTags = cache(async () => {
  const result = await createServerApi(CACHE_TAGS).GET('/api/tags');
  return requireData(result, '태그');
});

async function loadPostPage(page: number, filter: PostFilter): Promise<PostListResponseDto> {
  const result = await createServerApi(CACHE_TAGS).GET('/api/posts', {
    params: { query: { page, size: BLOG_PAGE_SIZE, ...filter } },
  });
  return requireData(result, '글 목록');
}

/** 추천 글이 없으면 null. 호출 쪽이 최신 글로 대신한다. */
export async function loadFeaturedPost(): Promise<PostSummaryDto | null> {
  const result = await createServerApi(CACHE_TAGS).GET('/api/posts', {
    params: { query: { featured: true, size: 1 } },
  });
  return requireData(result, '추천 글').items[0] ?? null;
}

export type BlogListing = {
  posts: PostSummaryDto[];
  /** 실제로 이어 그린 마지막 페이지(요청 값을 totalPages로 줄인 값) */
  page: number;
  totalPages: number;
  /** 필터 없는 1페이지 첫 글. Overlay 대체용 */
  firstPost: PostSummaryDto | undefined;
};

/**
 * 1~page 페이지를 차례대로 이어 붙여 돌려준다(`?page=n` 새로고침 복원).
 * totalPages를 알아야 page를 줄일 수 있어 1페이지를 먼저 받고, 나머지는 병렬로 받는다.
 */
export async function loadBlogListing(
  requestedPage: number,
  filter: PostFilter,
): Promise<BlogListing> {
  const first = await loadPostPage(FIRST_PAGE, filter);
  const page = clampPage(requestedPage, first.totalPages);
  const laterPageNumbers = Array.from({ length: page - FIRST_PAGE }, (_, i) => FIRST_PAGE + 1 + i);
  const later = await Promise.all(laterPageNumbers.map((n) => loadPostPage(n, filter)));

  return {
    posts: mergePostsBySlug(first.items, ...later.map((result) => result.items)),
    page,
    totalPages: first.totalPages,
    firstPost: first.items[0],
  };
}
