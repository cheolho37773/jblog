import 'server-only';
import { createUncachedServerApi } from '@/lib/api/server';

/** 검색 결과 한 번에 보여 줄 최대 개수. API가 허용하는 size 최대값이다. */
export const SEARCH_RESULT_LIMIT = 50;

// 검색은 요청마다 새로 조회한다(프론트엔드 §4 `no-store`). 5xx·네트워크 오류는 클라이언트가 던져 오류 화면이 된다.
export async function searchPosts(q: string) {
  const result = await createUncachedServerApi().GET('/api/search', {
    params: { query: { q, page: 1, size: SEARCH_RESULT_LIMIT } },
  });
  if (result.data === undefined) throw new Error('검색 조회 실패');
  return result.data;
}
