import type { components } from '@/generated/api-types';

type PostSummaryDto = components['schemas']['PostSummaryDto'];

// 글이 적을 때 Featured가 Latest와 거의 같은 글을 되풀이하므로, 이만큼 쌓인 뒤에만 보여 준다 (UI §7.1).
const MIN_PUBLISHED_FOR_FEATURED = 4;

type PickHomeFeaturedInput = {
  /** `GET /api/posts?featured=true&size=1`의 items */
  featuredItems: PostSummaryDto[];
  /** 최신 목록(`GET /api/posts`)의 totalItems */
  totalPublished: number;
};

/** Home에 Featured Post를 그릴지 정한다. 그릴 글이 없으면 null. */
export function pickHomeFeatured({
  featuredItems,
  totalPublished,
}: PickHomeFeaturedInput): PostSummaryDto | null {
  if (totalPublished < MIN_PUBLISHED_FOR_FEATURED) return null;
  return featuredItems[0] ?? null;
}
