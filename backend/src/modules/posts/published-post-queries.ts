import type { Prisma, PrismaClient } from '../../generated/prisma/client';
import { MAX_RELATED_POSTS } from './dto/post-detail-response.dto';
import type { PostSummaryDto } from './dto/post-summary.dto';
import { POST_SUMMARY_SELECT, toPostSummary } from './post-mapper';
import { NEWEST_FIRST, publishedPostWhere } from './published-post';

// 공개 API(PrismaClient)와 내부 API(스냅샷 트랜잭션의 tx)가 같은 조회 정의를 쓰도록
// 어느 쪽이든 받는 최소한의 클라이언트 형태. 호출하는 쪽이 어느 시점을 읽을지 정한다.
export type PostDb = PrismaClient | Prisma.TransactionClient;

export interface PostPosition {
  id: number;
  publishedAt: Date | null;
  categoryId: number | null;
}

// 현재 slug가 아닌 예약 slug(이전 slug)면 현재 slug를 찾는다. 대상 글이 비공개이거나 삭제됐으면 null이다.
export async function findCurrentSlugOfOldSlug(db: PostDb, slug: string): Promise<string | null> {
  const oldSlug = await db.postSlug.findFirst({
    where: { slug, isCurrent: false, post: publishedPostWhere() },
    select: { post: { select: { slug: true } } },
  });
  return oldSlug?.post?.slug ?? null;
}

// 정렬(publishedAt desc, id desc)에서 바로 이웃한 공개 글. older = 목록에서 바로 뒤, newer = 바로 앞.
export async function findNeighbor(
  db: PostDb,
  post: PostPosition,
  direction: 'older' | 'newer',
): Promise<{ slug: string; title: string } | null> {
  const { publishedAt, id } = post;
  if (publishedAt === null) return null;
  const isOlder = direction === 'older';
  const comparison = isOlder ? 'lt' : 'gt';
  return db.post.findFirst({
    where: {
      AND: [
        publishedPostWhere(),
        {
          OR: [
            { publishedAt: { [comparison]: publishedAt } },
            { publishedAt, id: { [comparison]: id } },
          ],
        },
      ],
    },
    orderBy: isOlder ? NEWEST_FIRST : [{ publishedAt: 'asc' }, { id: 'asc' }],
    select: { slug: true, title: true },
  });
}

export async function findRelated(db: PostDb, post: PostPosition): Promise<PostSummaryDto[]> {
  if (post.categoryId === null) return [];
  const rows = await db.post.findMany({
    where: { ...publishedPostWhere(), categoryId: post.categoryId, id: { not: post.id } },
    orderBy: NEWEST_FIRST,
    take: MAX_RELATED_POSTS,
    select: POST_SUMMARY_SELECT,
  });
  return rows.map(toPostSummary);
}
