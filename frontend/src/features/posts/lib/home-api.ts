import 'server-only';
import { createServerApi } from '@/lib/api/server';
import { pickHomeFeatured } from './home-featured';

export const HOME_LATEST_COUNT = 6;
const CACHE_TAGS = ['posts'];

async function fetchPosts(query: { featured?: boolean; size: number }) {
  const result = await createServerApi(CACHE_TAGS).GET('/api/posts', { params: { query } });
  // 조회 실패는 빈 값으로 바꾸지 않고 오류로 끝낸다(5xx는 클라이언트가 이미 던진다)
  if (result.data === undefined) throw new Error('Home 글 조회 실패');
  return result.data;
}

/** Home에 필요한 두 목록(Featured 후보, 최신 글)을 병렬로 받는다. */
export async function loadHomePosts() {
  const [featured, latest] = await Promise.all([
    fetchPosts({ featured: true, size: 1 }),
    fetchPosts({ size: HOME_LATEST_COUNT }),
  ]);
  return {
    featured: pickHomeFeatured({
      featuredItems: featured.items,
      totalPublished: latest.totalItems,
    }),
    latest: latest.items,
  };
}
