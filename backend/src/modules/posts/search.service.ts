import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { PostListResponseDto } from './dto/post-list-response.dto';
import type { PostSummaryDto } from './dto/post-summary.dto';
import type { SearchQueryDto } from './dto/post-queries.dto';
import { type PageRequest, resolvePageRequest, skipOf, toPostList } from './pagination';
import { POST_SUMMARY_SELECT, toPostSummary } from './post-mapper';
import { PUBLISHED_POST_SQL, publishedPostWhere } from './published-post';

// LIKE 와일드카드(%, _)와 이스케이프 문자(\)를 글자 그대로 찾도록 앞에 \를 붙인다.
// PostgreSQL LIKE의 기본 이스케이프 문자가 \ 이다.
export function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, '\\$&');
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  // 백엔드 §5.4. 모든 값은 $queryRaw 템플릿의 바인딩 파라미터로만 들어간다(문자열 이어 붙이기 없음).
  async search(query: SearchQueryDto): Promise<PostListResponseDto> {
    const pageRequest = resolvePageRequest(query);
    const pattern = `%${escapeLikePattern(query.q)}%`;
    const matches = Prisma.sql`${PUBLISHED_POST_SQL}
      AND (title ILIKE ${pattern} OR excerpt ILIKE ${pattern} OR "contentMd" ILIKE ${pattern})`;

    const [totalItems, ids] = await Promise.all([
      this.countMatches(matches),
      this.findPageIds(matches, pattern, pageRequest),
    ]);
    const items = await this.loadInOrder(ids);
    return toPostList(items, totalItems, pageRequest);
  }

  private async countMatches(matches: Prisma.Sql): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ total: bigint }[]>`
      SELECT count(*) AS total FROM "Post" WHERE ${matches}`;
    return Number(rows[0]?.total ?? 0);
  }

  // 제목 일치가 본문 일치보다 앞, 그다음 최근순(같은 시각이면 id 큰 글 먼저).
  private async findPageIds(
    matches: Prisma.Sql,
    pattern: string,
    pageRequest: PageRequest,
  ): Promise<number[]> {
    const rows = await this.prisma.$queryRaw<{ id: number }[]>`
      SELECT id FROM "Post"
      WHERE ${matches}
      ORDER BY (title ILIKE ${pattern}) DESC, "publishedAt" DESC, id DESC
      LIMIT ${pageRequest.size} OFFSET ${skipOf(pageRequest)}`;
    return rows.map((row) => row.id);
  }

  // 목록과 같은 형태로 만들기 위해 Prisma로 다시 읽고, raw 쿼리가 정한 순서를 되살린다.
  // ID 조회와 이 재조회 사이에 비공개로 바뀐 글이 응답에 새지 않도록 공개 조건을 다시 건다.
  // 그 경합이 있으면 totalItems보다 items가 적을 수 있다. 비공개 글을 노출하는 것보다 안전하다.
  private async loadInOrder(ids: number[]): Promise<PostSummaryDto[]> {
    const rows = await this.prisma.post.findMany({
      where: { id: { in: ids }, ...publishedPostWhere() },
      select: { id: true, ...POST_SUMMARY_SELECT },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids.flatMap((id) => {
      const row = byId.get(id);
      return row === undefined ? [] : [toPostSummary(row)];
    });
  }
}
