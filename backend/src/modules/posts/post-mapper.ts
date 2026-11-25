import type { Prisma } from '../../generated/prisma/client';
import { PostDetailDto } from './dto/post-detail.dto';
import { PostSummaryDto } from './dto/post-summary.dto';
import { buildAutoExcerpt } from './excerpt';

// 공개 응답에 필요한 컬럼만 읽는다. version은 읽지 않고, contentMd는 excerpt 자동 생성에만 쓴다(응답에 싣지 않는다).
export const POST_SUMMARY_SELECT = {
  slug: true,
  title: true,
  excerpt: true,
  contentMd: true,
  coverImageUrl: true,
  publishedAt: true,
  readingMinutes: true,
  viewCount: true,
  likeCount: true,
  category: { select: { name: true, slug: true } },
} satisfies Prisma.PostSelect;

export const POST_DETAIL_SELECT = {
  ...POST_SUMMARY_SELECT,
  isFeatured: true,
  seoTitle: true,
  seoDescription: true,
  updatedAt: true,
  tags: {
    select: { tag: { select: { name: true, slug: true } } },
    orderBy: { tag: { name: 'asc' } },
  },
} satisfies Prisma.PostSelect;

type SummaryRow = Prisma.PostGetPayload<{ select: typeof POST_SUMMARY_SELECT }>;
type DetailRow = Prisma.PostGetPayload<{ select: typeof POST_DETAIL_SELECT }>;

// 공개 조건(published-post.ts)을 거친 글만 여기 들어오므로 publishedAt은 항상 있다.
function publishedAtOf(row: { publishedAt: Date | null }): string {
  if (row.publishedAt === null) throw new Error('공개 글에 publishedAt이 없습니다');
  return row.publishedAt.toISOString();
}

export function toPostSummary(row: SummaryRow): PostSummaryDto {
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt ?? buildAutoExcerpt(row.contentMd),
    coverImageUrl: row.coverImageUrl,
    category: row.category,
    publishedAt: publishedAtOf(row),
    readingMinutes: row.readingMinutes,
    viewCount: row.viewCount,
    likeCount: row.likeCount,
  };
}

export function toPostDetail(row: DetailRow): PostDetailDto {
  return {
    ...toPostSummary(row),
    tags: row.tags.map((postTag) => postTag.tag),
    isFeatured: row.isFeatured,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    updatedAt: row.updatedAt.toISOString(),
  };
}
