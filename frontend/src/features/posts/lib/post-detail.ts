import type { components } from '@/generated/api-types';

type InternalPostResponseDto = components['schemas']['InternalPostResponseDto'];
type InternalPostRedirectDto = components['schemas']['InternalPostRedirectDto'];

export type PostDetail = InternalPostResponseDto;

/** openapi-fetch 결과 중 분기에 필요한 부분만 받는다(순수 함수로 단위 테스트하려고). */
export type PostDetailResult = {
  data?: InternalPostResponseDto | InternalPostRedirectDto;
  response: { status: number };
};

export type PostDetailOutcome =
  | { kind: 'found'; detail: PostDetail }
  | { kind: 'redirect'; redirectTo: string }
  | { kind: 'not-found' };

const HTTP_OK = 200;
// 없는 글(404)과 slug 형식 오류(400)만 "없는 글"이다 (지시서 "데이터 조회").
const NOT_FOUND_STATUSES = new Set([400, 404]);

/**
 * 내부 API 응답을 글·영구 이동·없음으로 나눈다.
 * 401(키 문제)·403·429·5xx 같은 나머지 실패는 404로 바꾸지 않고 던진다. 키 문제를 "없는 글"로 숨기면 운영 장애를 놓친다.
 */
export function resolvePostDetail(result: PostDetailResult): PostDetailOutcome {
  const { status } = result.response;
  const body = result.data;
  if (NOT_FOUND_STATUSES.has(status)) return { kind: 'not-found' };
  if (status !== HTTP_OK || !body) throw new Error(`글 상세 조회 실패: ${status}`);
  if ('redirectTo' in body) return { kind: 'redirect', redirectTo: body.redirectTo };
  return { kind: 'found', detail: body };
}
