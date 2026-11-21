import 'server-only';
import createClient from 'openapi-fetch';
import type { paths } from '@/generated/api-types';
import { env } from '@/lib/env';

// Next.js fetch 캐시 확장(next.tags)을 openapi-fetch의 requestInitExt로 넘긴다.
// 태그는 호출마다 다르므로(예: posts, post:<slug>) 호출 측이 태그를 정해 클라이언트를 만든다 (프론트엔드 §4).
export function createServerApi(cacheTags: string[] = []) {
  return createClient<paths>({
    baseUrl: env.server.API_INTERNAL_URL,
    requestInitExt: cacheTags.length > 0 ? { next: { tags: cacheTags } } : undefined,
  });
}
