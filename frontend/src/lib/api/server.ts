import 'server-only';
import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from '@/generated/api-types';
import { env } from '@/lib/env';

// Next.js fetch 캐시 재검증 주기(초). 태그 무효화(revalidateTag)가 먼저 반영되고 이 값은 안전망이다 (프론트엔드 §4).
const REVALIDATE_SECONDS = 3600;
const INTERNAL_KEY_HEADER = 'X-Internal-Key';
const SERVER_ERROR_STATUS_MIN = 500;

// 5xx는 빈 값으로 바꾸지 않고 예외로 올려 페이지가 오류로 끝나게 한다 (네트워크 오류는 fetch가 이미 던진다).
const throwOnServerError: Middleware = {
  onResponse({ response }) {
    if (response.status >= SERVER_ERROR_STATUS_MIN) {
      throw new Error(`API 서버 오류: ${response.status}`);
    }
  },
};

// 태그는 호출마다 다르므로(예: posts, post:<slug>) 호출 측이 정해 클라이언트를 만든다.
// openapi-fetch의 requestInitExt로 Next.js fetch 확장(next.*)을 넘긴다.
function createApi(cacheTags: string[]) {
  return createApiWith({ next: { revalidate: REVALIDATE_SECONDS, tags: cacheTags } });
}

type NextFetchExt = { cache?: 'no-store'; next?: { revalidate: number; tags: string[] } };

function createApiWith(requestInitExt: NextFetchExt) {
  const client = createClient<paths>({
    baseUrl: env.server.API_INTERNAL_URL,
    requestInitExt,
  });
  client.use(throwOnServerError);
  return client;
}

// 공개 API용.
export function createServerApi(cacheTags: string[] = []) {
  return createApi(cacheTags);
}

// 캐시하지 않는 공개 API용(검색처럼 요청마다 새로 조회해야 하는 곳).
export function createUncachedServerApi() {
  return createApiWith({ cache: 'no-store' });
}

// 내부 API용(/internal/*). 키는 서버에서만 붙이며 브라우저 번들에 들어가지 않는다 (server-only).
export function createInternalApi(cacheTags: string[] = []) {
  const client = createApi(cacheTags);
  // 호출 쪽 params.header는 생성 타입이 요구하는 자리 채움일 뿐이라, 요청 직전에 실제 키로 덮어쓴다.
  client.use({
    onRequest({ request }) {
      request.headers.set(INTERNAL_KEY_HEADER, env.server.INTERNAL_API_KEY);
      return request;
    },
  });
  return client;
}
