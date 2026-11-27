import 'server-only';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';
import { createInternalApi } from '@/lib/api/server';
import { resolvePostDetail, type PostDetail } from './post-detail';

// 생성 타입이 header를 필수로 요구해 넣는 자리 채움 값이다. 실제 키는 createInternalApi가 요청 직전에 덮어쓴다.
const KEY_PLACEHOLDER = 'set-by-createInternalApi';

/**
 * 글 상세를 내부 API 한 번으로 받는다(서버 전용, 원문 포함).
 * generateMetadata와 페이지가 같은 요청 안에서 함께 부르므로 React cache로 1회만 호출한다.
 * 이전 slug는 308, 없는 글은 404로 끝내고, 그 밖의 실패(키 문제·5xx·네트워크 오류)는 그대로 던진다.
 */
export const loadPostDetail = cache(async (slug: string): Promise<PostDetail> => {
  const result = await createInternalApi(['posts', `post:${slug}`]).GET('/internal/posts/{slug}', {
    params: { path: { slug }, header: { 'X-Internal-Key': KEY_PLACEHOLDER } },
  });
  const outcome = resolvePostDetail(result);
  if (outcome.kind === 'redirect') permanentRedirect(`/blog/${outcome.redirectTo}`);
  if (outcome.kind === 'not-found') notFound();
  return outcome.detail;
});
