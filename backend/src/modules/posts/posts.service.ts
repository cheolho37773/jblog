import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { PostDetailResponseDto } from './dto/post-detail-response.dto';
import type { PostListResponseDto } from './dto/post-list-response.dto';
import type { PostListQueryDto } from './dto/post-queries.dto';
import { hasItemsOnPage, resolvePageRequest, skipOf, toPostList } from './pagination';
import {
  POST_DETAIL_SELECT,
  POST_SUMMARY_SELECT,
  toPostDetail,
  toPostSummary,
} from './post-mapper';
import { NEWEST_FIRST, publishedPostWhere } from './published-post';
import { findCurrentSlugOfOldSlug, findNeighbor, findRelated } from './published-post-queries';

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
    const totalItems = await this.prisma.post.count({ where });
    // 범위를 넘는 page는 DB에 skip을 넘기지 않고 빈 목록으로 답한다.
    if (!hasItemsOnPage(totalItems, pageRequest)) return toPostList([], totalItems, pageRequest);

    const rows = await this.prisma.post.findMany({
      where,
      orderBy: NEWEST_FIRST,
      skip: skipOf(pageRequest),
      take: pageRequest.size,
      select: POST_SUMMARY_SELECT,
    });
    return toPostList(rows.map(toPostSummary), totalItems, pageRequest);
  }

  async getDetail(slug: string): Promise<PostDetailResult> {
    const post = await this.prisma.post.findFirst({
      where: { slug, ...publishedPostWhere() },
      select: { ...POST_DETAIL_SELECT, id: true, categoryId: true },
    });
    if (post === null) return this.findMovedPost(slug);

    const [prev, next, related] = await Promise.all([
      findNeighbor(this.prisma, post, 'older'),
      findNeighbor(this.prisma, post, 'newer'),
      findRelated(this.prisma, post),
    ]);
    return { kind: 'found', detail: { post: toPostDetail(post), prev, next, related } };
  }

  private async findMovedPost(slug: string): Promise<PostDetailResult> {
    const currentSlug = await findCurrentSlugOfOldSlug(this.prisma, slug);
    return currentSlug === null ? { kind: 'missing' } : { kind: 'moved', currentSlug };
  }
}
