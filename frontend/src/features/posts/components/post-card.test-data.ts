import type { components } from '@/generated/api-types';

export type PostSummaryDto = components['schemas']['PostSummaryDto'];
export type CategoryWithCountDto = components['schemas']['CategoryWithCountDto'];

// 테스트용 더미 글. 계약 기준: api-types.ts PostSummaryDto.
export function makePost(overrides: Partial<PostSummaryDto> = {}): PostSummaryDto {
  return {
    title: '첫 번째 글',
    slug: 'hello-world',
    excerpt: '요약 문장',
    coverImageUrl: '/uploads/fixtures/cover-indigo.png',
    category: { name: '백엔드', slug: 'backend' },
    publishedAt: '2026-01-04T15:00:00.000Z',
    readingMinutes: 5,
    likeCount: 0,
    viewCount: 0,
    ...overrides,
  };
}
