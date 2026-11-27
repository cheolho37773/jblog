import type { components } from '@/generated/api-types';

type PostSummaryDto = components['schemas']['PostSummaryDto'];

/** 목록을 차례대로 이어 붙이되 같은 slug는 앞에 나온 것만 남긴다. 입력은 바꾸지 않는다. */
export function mergePostsBySlug(...lists: PostSummaryDto[][]): PostSummaryDto[] {
  const seen = new Set<string>();
  const merged: PostSummaryDto[] = [];
  for (const post of lists.flat()) {
    if (seen.has(post.slug)) continue;
    seen.add(post.slug);
    merged.push(post);
  }
  return merged;
}
