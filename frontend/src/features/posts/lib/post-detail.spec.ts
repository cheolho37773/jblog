import { describe, expect, it } from 'vitest';
import type { components } from '@/generated/api-types';
import { makePost } from '../components/post-card.test-data';

/**
 * M2-08 ① 단계: 내부 API 응답 분기 순수 함수 계약 (구현 전 작성, 동적 import).
 * 구현자가 만들 모듈: `features/posts/lib/post-detail.ts`
 *   resolvePostDetail(result: { data?: InternalPostResponseDto | InternalPostRedirectDto; response: { status: number } })
 *     -> { kind: 'found'; detail: InternalPostResponseDto }
 *      | { kind: 'redirect'; redirectTo: string }
 *      | { kind: 'not-found' }
 *   - 200 + `post`가 있는 data  -> found
 *   - 200 + `redirectTo`가 있는 data -> redirect
 *   - 404, 400(slug 형식 오류) -> not-found
 *   - 401·403·429 등 그 밖의 4xx, 5xx, data가 비어 있는 200 -> Error를 던진다(404로 바꾸지 않는다)
 *   네트워크 오류는 fetch가 던지는 예외라 이 함수에 오지 않는다(호출 쪽이 그대로 올린다).
 */

type Schemas = components['schemas'];
type Detail = Schemas['InternalPostResponseDto'];
type Redirect = Schemas['InternalPostRedirectDto'];
type Input = { data?: Detail | Redirect; response: { status: number } };
type Outcome =
  | { kind: 'found'; detail: Detail }
  | { kind: 'redirect'; redirectTo: string }
  | { kind: 'not-found' };

async function load(): Promise<(input: Input) => Outcome> {
  const path = './post-detail';
  const mod = (await import(/* @vite-ignore */ path)) as {
    resolvePostDetail: (input: Input) => Outcome;
  };
  return mod.resolvePostDetail;
}

const detail: Detail = {
  post: {
    ...makePost(),
    tags: [],
    isFeatured: false,
    seoTitle: null,
    seoDescription: null,
    updatedAt: '2026-01-04T15:00:00.000Z',
    contentMd: '## 제목',
    version: 1,
  },
  prev: null,
  next: null,
  related: [],
};

describe('resolvePostDetail', () => {
  it('글이 있으면 found와 응답 전체를 돌려준다', async () => {
    const resolve = await load();
    expect(resolve({ data: detail, response: { status: 200 } })).toEqual({
      kind: 'found',
      detail,
    });
  });

  it('{ redirectTo }면 redirect와 새 slug를 돌려준다', async () => {
    const resolve = await load();
    expect(resolve({ data: { redirectTo: 'new-slug' }, response: { status: 200 } })).toEqual({
      kind: 'redirect',
      redirectTo: 'new-slug',
    });
  });

  it.each([404, 400])('상태 %i는 not-found다(없는 글·slug 형식 오류)', async (status) => {
    const resolve = await load();
    expect(resolve({ response: { status } })).toEqual({ kind: 'not-found' });
  });

  it.each([401, 403, 429])(
    '상태 %i는 404로 바꾸지 않고 오류로 끝낸다(키 문제를 없는 글로 숨기지 않는다)',
    async (status) => {
      const resolve = await load();
      expect(() => resolve({ response: { status } })).toThrow();
    },
  );

  it.each([500, 502, 503])('상태 %i(서버 오류)는 오류로 끝낸다', async (status) => {
    const resolve = await load();
    expect(() => resolve({ response: { status } })).toThrow();
  });

  it('200인데 data가 비어 있으면 not-found가 아니라 오류다', async () => {
    const resolve = await load();
    expect(() => resolve({ response: { status: 200 } })).toThrow();
  });
});
