// 개발·디자인 검수용 기본 데이터 (백엔드 §3.3). `pnpm --filter @jblog/backend db:seed`(= prisma db seed)로 실행한다.
//
// 여러 번 실행해도 같은 상태가 된다: 이미 있는 행은 건너뛰고 바꾸지 않는다(관리자 화면에서 고친 내용 보존).
// 관리자 계정(User)은 넣지 않는다: 허용된 GitHub 계정의 최초 로그인 때 만들어진다.
import { readProcessEnv } from '../src/config/env.source';
import { isDatabaseUrl } from '../src/config/env.validation';
import { PostStatus, PrismaClient } from '../src/generated/prisma/client';
import { createPrismaAdapter } from '../src/prisma/prisma-adapter';
import {
  PROFILE_SINGLETON_ID,
  SAMPLE_POSTS,
  SAMPLE_PROFILE,
  type SamplePost,
  SEED_CATEGORIES,
  sampleContentMarkdown,
  sampleExcerpt,
} from './seed-content';

async function seedProfile(prisma: PrismaClient): Promise<void> {
  await prisma.profile.upsert({
    where: { id: PROFILE_SINGLETON_ID },
    create: { id: PROFILE_SINGLETON_ID, ...SAMPLE_PROFILE },
    update: {},
  });
}

// 카테고리 이름 → id. 글을 넣을 때 쓴다.
async function seedCategories(prisma: PrismaClient): Promise<Map<string, number>> {
  const categoryIds = new Map<string, number>();
  for (const [sortOrder, category] of SEED_CATEGORIES.entries()) {
    const saved = await prisma.category.upsert({
      where: { name: category.name },
      create: { ...category, sortOrder },
      update: {},
      select: { id: true },
    });
    categoryIds.set(category.name, saved.id);
  }
  return categoryIds;
}

// slug는 한 번 쓰면 영구 예약이다(개요 D20). 이미 예약된 slug면 글이 지워졌거나 slug가 바뀐 경우이므로
// 같은 slug로 새 글을 만들지 않고 건너뛴다. 글과 현재 PostSlug는 중첩 생성으로 함께 커밋된다.
async function seedPost(
  prisma: PrismaClient,
  post: SamplePost,
  categoryIds: Map<string, number>,
): Promise<void> {
  const reserved = await prisma.postSlug.findUnique({ where: { slug: post.slug } });
  if (reserved) return;

  await prisma.post.create({
    data: {
      slug: post.slug,
      title: post.title,
      excerpt: sampleExcerpt(post),
      contentMd: sampleContentMarkdown(post),
      status: post.publishedAt ? PostStatus.PUBLISHED : PostStatus.DRAFT,
      publishedAt: post.publishedAt,
      isFeatured: post.isFeatured,
      readingMinutes: post.readingMinutes,
      categoryId: categoryIds.get(post.categoryName) ?? null,
      slugs: { create: { slug: post.slug, isCurrent: true } },
    },
  });
}

export async function seedDatabase(prisma: PrismaClient): Promise<void> {
  await seedProfile(prisma);
  const categoryIds = await seedCategories(prisma);
  for (const post of SAMPLE_POSTS) {
    await seedPost(prisma, post, categoryIds);
  }
}

// CLI 진입점. 접속 URL은 앱과 같은 설정 모듈(backend/.env + 셸 값)에서 읽고, 오류 메시지에는 값을 넣지 않는다.
async function main(): Promise<void> {
  const databaseUrl = readProcessEnv().DATABASE_URL;
  if (!isDatabaseUrl(databaseUrl)) {
    throw new Error('DATABASE_URL이 없거나 형식이 올바르지 않습니다 (backend/.env.example 참고)');
  }
  const prisma = new PrismaClient({ adapter: createPrismaAdapter(databaseUrl) });
  try {
    await seedDatabase(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

// 통합 테스트는 seedDatabase만 import해 쓰므로, 직접 실행했을 때만 main을 돈다.
if (require.main === module) {
  main().catch((error: unknown) => {
    console.error('seed 실패', error);
    process.exitCode = 1;
  });
}
