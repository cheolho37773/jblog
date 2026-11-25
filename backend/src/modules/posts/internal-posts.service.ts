import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { InternalPostResponseDto } from './dto/internal-post-response.dto';
import { POST_DETAIL_SELECT, toPostDetail } from './post-mapper';
import { publishedPostWhere } from './published-post';
import {
  findCurrentSlugOfOldSlug,
  findNeighbor,
  findRelated,
  type PostDb,
} from './published-post-queries';

// 내부 상세 조회 결과. 이전 slug면 새 slug만 알려 준다.
export type InternalPostResult =
  | { kind: 'found'; detail: InternalPostResponseDto }
  | { kind: 'moved'; currentSlug: string }
  | { kind: 'missing' };

const INTERNAL_POST_SELECT = {
  ...POST_DETAIL_SELECT,
  id: true,
  categoryId: true,
  version: true,
} satisfies Prisma.PostSelect;

@Injectable()
export class InternalPostsService {
  constructor(private readonly prisma: PrismaService) {}

  // 본문·메타·prev/next/related를 한 시점에서 읽도록 전부 같은 트랜잭션(tx)으로 조회한다 (백엔드 §4.5·§5.8).
  // REPEATABLE READ는 첫 쿼리 시점의 스냅샷을 트랜잭션 내내 유지한다.
  async getDetail(slug: string): Promise<InternalPostResult> {
    // 공개 기준 시각은 요청당 한 번만 정해 본문·prev/next/related가 같은 공개 집합을 보게 한다.
    const asOf = new Date();
    return this.prisma.$transaction(
      async (tx) => {
        // Prisma는 읽기 전용 옵션이 없어 PostgreSQL 명령으로 설정한다. 첫 쿼리 전에 해야 한다.
        // 읽기 전용이면 이 경로의 실수로 쓰기가 생겨도 DB가 막는다.
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        return this.readDetail(tx, slug, asOf);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private async readDetail(db: PostDb, slug: string, asOf: Date): Promise<InternalPostResult> {
    const post = await db.post.findFirst({
      where: { slug, ...publishedPostWhere(asOf) },
      select: INTERNAL_POST_SELECT,
    });
    if (post === null) return this.findMoved(db, slug, asOf);

    // 한 트랜잭션 연결을 쓰므로 순서대로 읽는다.
    const prev = await findNeighbor(db, post, { direction: 'older', asOf });
    const next = await findNeighbor(db, post, { direction: 'newer', asOf });
    const related = await findRelated(db, post, asOf);
    const internalPost = {
      ...toPostDetail(post),
      contentMd: post.contentMd,
      version: post.version,
    };
    return { kind: 'found', detail: { post: internalPost, prev, next, related } };
  }

  private async findMoved(db: PostDb, slug: string, asOf: Date): Promise<InternalPostResult> {
    const currentSlug = await findCurrentSlugOfOldSlug(db, slug, asOf);
    return currentSlug === null ? { kind: 'missing' } : { kind: 'moved', currentSlug };
  }
}
