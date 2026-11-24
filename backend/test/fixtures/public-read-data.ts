// 공개 조회 통합 테스트(M2-03)가 DB에 직접 넣는 데이터와 응답 검사 도구.
// 시드가 바뀌어도 테스트 의미가 유지되도록, 각 테스트 파일이 이 함수로 필요한 행만 만든다.
import type { PrismaClient } from '../../src/generated/prisma/client';

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface CategoryInput {
  name: string;
  slug: string;
  sortOrder: number;
}

export async function createCategory(prisma: PrismaClient, input: CategoryInput): Promise<number> {
  const saved = await prisma.category.create({ data: input, select: { id: true } });
  return saved.id;
}

export async function createTag(
  prisma: PrismaClient,
  input: { name: string; slug: string },
): Promise<number> {
  const saved = await prisma.tag.create({ data: input, select: { id: true } });
  return saved.id;
}

export interface PostInput {
  slug: string;
  title: string;
  status?: 'DRAFT' | 'PUBLISHED';
  // null이면 publishedAt 없음(초안). 지정하지 않으면 지금보다 1일 전.
  publishedAt?: Date | null;
  excerpt?: string | null;
  contentMd?: string;
  categoryId?: number | null;
  tagIds?: number[];
  isFeatured?: boolean;
  coverImageUrl?: string | null;
}

/** 글과 현재 PostSlug를 함께 만든다. 호출 순서대로 id가 커진다. */
export async function createPost(prisma: PrismaClient, input: PostInput): Promise<number> {
  const saved = await prisma.post.create({
    data: {
      slug: input.slug,
      title: input.title,
      excerpt: input.excerpt === undefined ? `요약 ${input.slug}` : input.excerpt,
      contentMd: input.contentMd ?? `본문 ${input.slug}`,
      status: input.status ?? 'PUBLISHED',
      publishedAt:
        input.publishedAt === undefined ? new Date(Date.now() - MS_PER_DAY) : input.publishedAt,
      categoryId: input.categoryId ?? null,
      isFeatured: input.isFeatured ?? false,
      coverImageUrl: input.coverImageUrl ?? null,
      slugs: { create: { slug: input.slug, isCurrent: true } },
      tags: { create: (input.tagIds ?? []).map((tagId) => ({ tagId })) },
    },
    select: { id: true },
  });
  return saved.id;
}

/** 이전 slug(영구 예약) 행. postId가 null이면 삭제된 글의 slug다. */
export async function createOldSlug(
  prisma: PrismaClient,
  slug: string,
  postId: number | null,
): Promise<void> {
  await prisma.postSlug.create({ data: { slug, postId, isCurrent: false } });
}

// 공개 API 어디에도 나오면 안 되는 키(백엔드 §4.2).
const INTERNAL_ONLY_KEYS = ['contentMd', 'version'];

/** 응답 본문 전체를 재귀로 훑어 내부 전용 키가 있는 경로를 모은다. */
export function findInternalOnlyKeys(value: unknown, path = '$'): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findInternalOnlyKeys(item, `${path}[${index}]`));
  }
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => [
    ...(INTERNAL_ONLY_KEYS.includes(key) ? [`${path}.${key}`] : []),
    ...findInternalOnlyKeys(child, `${path}.${key}`),
  ]);
}
