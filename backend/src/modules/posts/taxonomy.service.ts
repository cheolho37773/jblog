import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CategoryWithCountDto, TagWithCountDto } from './dto/count.dto';
import { publishedPostWhere } from './published-post';

@Injectable()
export class TaxonomyService {
  constructor(private readonly prisma: PrismaService) {}

  // 글이 0개인 카테고리도 포함한다. 필터 칩에 보일지는 프론트가 정한다.
  async listCategories(): Promise<CategoryWithCountDto[]> {
    const asOf = new Date();
    const rows = await this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        name: true,
        slug: true,
        _count: { select: { posts: { where: publishedPostWhere(asOf) } } },
      },
    });
    return rows.map(({ name, slug, _count }) => ({ name, slug, postCount: _count.posts }));
  }

  async listTags(): Promise<TagWithCountDto[]> {
    const asOf = new Date();
    const rows = await this.prisma.tag.findMany({
      orderBy: { name: 'asc' },
      select: {
        name: true,
        slug: true,
        _count: { select: { posts: { where: { post: publishedPostWhere(asOf) } } } },
      },
    });
    return rows.map(({ name, slug, _count }) => ({ name, slug, postCount: _count.posts }));
  }
}
