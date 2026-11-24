import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { PostSummaryDto } from './dto/post-summary.dto';
import { MAX_RELATED_POSTS, type PostDetailResponseDto } from './dto/post-detail-response.dto';
import type { PostListResponseDto } from './dto/post-list-response.dto';
import type { PostListQueryDto } from './dto/post-queries.dto';
import { resolvePageRequest, skipOf, toPostList } from './pagination';
import {
  POST_DETAIL_SELECT,
  POST_SUMMARY_SELECT,
  toPostDetail,
  toPostSummary,
} from './post-mapper';
import { NEWEST_FIRST, publishedPostWhere } from './published-post';

// 상세 조회 결과. 이전 slug로 들어오면 새 slug만 알려 주고, 응답 형식은 컨트롤러가 정한다.
export type PostDetailResult =
  | { kind: 'found'; detail: PostDetailResponseDto }
  | { kind: 'moved'; currentSlug: string }
  | { kind: 'missing' };

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PostListQueryDto): Promise<PostListResponseDto> {
    const pageRequest = resolvePageRequest(query);
    const where = {
      ...publishedPostWhere(),
      ...(query.category === undefined ? {} : { category: { slug: query.category } }),
      ...(query.tag === undefined ? {} : { tags: { some: { tag: { slug: query.tag } } } }),
      ...(query.featured === true ? { isFeatured: true } : {}),
    };
    const [rows, totalItems] = await Promise.all([
      this.prisma.post.findMany({
        where,
        orderBy: NEWEST_FIRST,
        skip: skipOf(pageRequest),
        take: pageRequest.size,
        select: POST_SUMMARY_SELECT,
      }),
      this.prisma.post.count({ where }),
    ]);
    return toPostList(rows.map(toPostSummary), totalItems, pageRequest);
  }

  async getDetail(slug: string): Promise<PostDetailResult> {
    const post = await this.prisma.post.findFirst({
      where: { slug, ...publishedPostWhere() },
      select: { ...POST_DETAIL_SELECT, id: true, categoryId: true },
    });
    if (post === null) return this.findMovedPost(slug);

    const [prev, next, related] = await Promise.all([
      this.findNeighbor(post, 'older'),
      this.findNeighbor(post, 'newer'),
      this.findRelated(post),
    ]);
    return { kind: 'found', detail: { post: toPostDetail(post), prev, next, related } };
  }

  // 현재 slug가 아닌 예약 slug(이전 slug)면 현재 slug를 찾는다. 대상 글이 비공개이거나 삭제됐으면 없는 글이다.
  private async findMovedPost(slug: string): Promise<PostDetailResult> {
    const oldSlug = await this.prisma.postSlug.findFirst({
      where: { slug, isCurrent: false, post: publishedPostWhere() },
      select: { post: { select: { slug: true } } },
    });
    if (oldSlug?.post == null) return { kind: 'missing' };
    return { kind: 'moved', currentSlug: oldSlug.post.slug };
  }

  // 정렬(publishedAt desc, id desc)에서 바로 이웃한 공개 글. older = 목록에서 바로 뒤, newer = 바로 앞.
  private async findNeighbor(
    post: { id: number; publishedAt: Date | null },
    direction: 'older' | 'newer',
  ): Promise<{ slug: string; title: string } | null> {
    const { publishedAt, id } = post;
    if (publishedAt === null) return null;
    const isOlder = direction === 'older';
    const comparison = isOlder ? 'lt' : 'gt';
    const published = publishedPostWhere();
    return this.prisma.post.findFirst({
      where: {
        AND: [
          published,
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

  private async findRelated(post: {
    id: number;
    categoryId: number | null;
  }): Promise<PostSummaryDto[]> {
    if (post.categoryId === null) return [];
    const rows = await this.prisma.post.findMany({
      where: { ...publishedPostWhere(), categoryId: post.categoryId, id: { not: post.id } },
      orderBy: NEWEST_FIRST,
      take: MAX_RELATED_POSTS,
      select: POST_SUMMARY_SELECT,
    });
    return rows.map(toPostSummary);
  }
}
