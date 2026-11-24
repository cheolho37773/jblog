import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from './dto/post-queries.dto';
import type { PostListResponseDto } from './dto/post-list-response.dto';
import type { PostSummaryDto } from './dto/post-summary.dto';

export interface PageRequest {
  page: number;
  size: number;
}

export function resolvePageRequest(query: { page?: number; size?: number }): PageRequest {
  return { page: query.page ?? DEFAULT_PAGE, size: query.size ?? DEFAULT_PAGE_SIZE };
}

export function skipOf({ page, size }: PageRequest): number {
  return (page - 1) * size;
}

// 개수를 먼저 구한 뒤 이 판단을 거쳐야 DB에 skip을 넘길 수 있다.
// page는 검증만 통과하면 매우 큰 값일 수 있어 (page-1)*size가 DB 정수 범위를 넘을 수 있다.
// 마지막 페이지 이내이면 skip은 totalItems 이하이므로 항상 안전하다.
// 개수가 0이면 마지막 페이지가 없으므로 page=1도 조회하지 않는다. 결과는 어차피 빈 목록이다.
export function hasItemsOnPage(totalItems: number, { page, size }: PageRequest): boolean {
  return page <= Math.ceil(totalItems / size);
}

// 목록 응답 공통 형식 (백엔드 §4.1). 범위를 넘는 page는 빈 items로 200이다.
export function toPostList(
  items: PostSummaryDto[],
  totalItems: number,
  { page, size }: PageRequest,
): PostListResponseDto {
  return { items, page, size, totalItems, totalPages: Math.ceil(totalItems / size) };
}
