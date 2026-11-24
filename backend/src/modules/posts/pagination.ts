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

// 목록 응답 공통 형식 (백엔드 §4.1). 범위를 넘는 page는 빈 items로 200이다.
export function toPostList(
  items: PostSummaryDto[],
  totalItems: number,
  { page, size }: PageRequest,
): PostListResponseDto {
  return { items, page, size, totalItems, totalPages: Math.ceil(totalItems / size) };
}
