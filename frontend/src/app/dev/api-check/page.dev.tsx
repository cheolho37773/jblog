import type { Metadata } from 'next';
import { connection } from 'next/server';
import { createInternalApi, createServerApi } from '@/lib/api/server';
import { BrowserCheck } from './BrowserCheck.dev';

// 개발 전용 환경 점검 페이지다. JBLOG_DEV_PAGES=1 빌드에서만 라우트가 되고 운영 빌드에는 들어가지 않는다 (next.config.ts).
export const metadata: Metadata = {
  title: 'API check (dev)',
  robots: { index: false, follow: false },
};

const CHECK_TAGS = ['dev-api-check'];

async function loadCategoryNames(): Promise<string[]> {
  const { data: categories } = await createServerApi(CHECK_TAGS).GET('/api/categories');
  if (!categories) throw new Error('/api/categories 조회 실패');
  return categories.map((category) => category.name);
}

// 추천 글 slug는 공개 API에서 얻고, 제목은 내부 API로 읽는다.
async function loadFeaturedInternalTitle(): Promise<string> {
  const list = await createServerApi(CHECK_TAGS).GET('/api/posts', {
    params: { query: { featured: true, size: 1 } },
  });
  const slug = list.data?.items[0]?.slug;
  if (!slug) throw new Error('추천 글을 찾지 못했다');

  // 실제 키는 createInternalApi가 요청 직전에 덮어쓴다(params는 생성 타입의 필수 자리 채움).
  const detail = await createInternalApi(CHECK_TAGS).GET('/internal/posts/{slug}', {
    params: { path: { slug }, header: { 'X-Internal-Key': 'set-by-createInternalApi' } },
  });
  if (!detail.data || !('post' in detail.data)) throw new Error('/internal/posts 조회 실패');
  return detail.data.post.title;
}

export default async function ApiCheckPage() {
  // 요청 시 렌더: 빌드(백엔드 없음)에서 조회하지 않게 한다. Next 16 공식 방식은 connection() (프론트엔드 §4).
  await connection();
  const [categoryNames, internalTitle] = await Promise.all([
    loadCategoryNames(),
    loadFeaturedInternalTitle(),
  ]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">API check</h1>
      <section aria-labelledby="api-check-server-title">
        <h2 id="api-check-server-title" className="font-semibold">
          서버 렌더 (/api/categories)
        </h2>
        <p data-testid="api-check-server">{categoryNames.join(', ')}</p>
      </section>
      <section aria-labelledby="api-check-browser-title">
        <h2 id="api-check-browser-title" className="font-semibold">
          브라우저 요청
        </h2>
        <BrowserCheck />
      </section>
      <section aria-labelledby="api-check-internal-title">
        <h2 id="api-check-internal-title" className="font-semibold">
          내부 API (/internal/posts)
        </h2>
        <p data-testid="api-check-internal">{internalTitle}</p>
      </section>
    </main>
  );
}
