import { describe, expect, it } from 'vitest';
import { makePost, type PostSummaryDto } from '../components/post-card.test-data';

/**
 * M2-07 ① 단계: slug 기준 중복 제거 순수 함수 계약 (구현 전 작성, 동적 import).
 * 구현자가 만들 모듈: `features/posts/lib/merge-posts.ts`
 *   mergePostsBySlug(...lists: PostSummaryDto[][]) -> PostSummaryDto[]   (앞에 나온 것을 남긴다)
 */

type Merge = (...lists: PostSummaryDto[][]) => PostSummaryDto[];

async function load(): Promise<Merge> {
  const path = './merge-posts';
  const mod = (await import(/* @vite-ignore */ path)) as { mergePostsBySlug: Merge };
  return mod.mergePostsBySlug;
}

const post = (slug: string, title = slug) => makePost({ slug, title });
const slugsOf = (posts: PostSummaryDto[]) => posts.map((p) => p.slug);

describe('mergePostsBySlug', () => {
  it('목록을 차례대로 이어 붙인다', async () => {
    const merge = await load();
    expect(slugsOf(merge([post('a'), post('b')], [post('c')]))).toEqual(['a', 'b', 'c']);
  });

  it('같은 slug는 앞에 나온 것을 남기고 뒤의 것을 버린다', async () => {
    const merge = await load();
    const result = merge([post('a', '앞'), post('b')], [post('a', '뒤'), post('c')]);
    expect(slugsOf(result)).toEqual(['a', 'b', 'c']);
    expect(result[0]?.title).toBe('앞');
  });

  it('한 목록 안의 중복도 제거한다', async () => {
    const merge = await load();
    expect(slugsOf(merge([post('a'), post('a'), post('b')]))).toEqual(['a', 'b']);
  });

  it('3개 이상의 목록(1~n 페이지)을 이어 붙일 때도 처음 나온 순서를 지킨다', async () => {
    const merge = await load();
    const result = merge([post('a'), post('b')], [post('b'), post('c')], [post('a'), post('d')]);
    expect(slugsOf(result)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('빈 목록·인자 없음은 빈 배열이다', async () => {
    const merge = await load();
    expect(merge()).toEqual([]);
    expect(merge([], [])).toEqual([]);
  });

  it('입력 배열을 바꾸지 않는다', async () => {
    const merge = await load();
    const first = [post('a')];
    const second = [post('a'), post('b')];
    merge(first, second);
    expect(slugsOf(first)).toEqual(['a']);
    expect(slugsOf(second)).toEqual(['a', 'b']);
  });
});
