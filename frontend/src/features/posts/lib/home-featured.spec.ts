import { describe, expect, it } from 'vitest';
import { makePost } from '../components/post-card.test-data';

/**
 * M2-09 ① 단계: Home Featured Post 조건 판정 순수 함수 계약 (구현 전 작성, 동적 import).
 * 구현자가 만들 모듈: `features/posts/lib/home-featured.ts`
 *   pickHomeFeatured({ featuredItems, totalPublished }) -> PostSummaryDto | null
 *     featuredItems: `GET /api/posts?featured=true&size=1`의 items, totalPublished: 최신 목록(`GET /api/posts`)의 totalItems.
 *     featured 글이 있고 발행 글이 4개 이상일 때만 첫 featured 글을 돌려주고, 아니면 null(UI §7.1, 지시서 Home 표).
 */

type Post = ReturnType<typeof makePost>;

async function load() {
  const path = './home-featured';
  return (await import(/* @vite-ignore */ path)) as {
    pickHomeFeatured: (input: { featuredItems: Post[]; totalPublished: number }) => Post | null;
  };
}

const featured = makePost({ slug: 'featured-one', title: '대표 글' });

describe('pickHomeFeatured (featured 글 유무 × 발행 글 수)', () => {
  it('featured 글이 없으면 발행 글이 많아도 null이다', async () => {
    const { pickHomeFeatured } = await load();
    expect(pickHomeFeatured({ featuredItems: [], totalPublished: 20 })).toBeNull();
  });

  it('featured 글이 없고 발행 글도 4개 미만이면 null이다', async () => {
    const { pickHomeFeatured } = await load();
    expect(pickHomeFeatured({ featuredItems: [], totalPublished: 3 })).toBeNull();
  });

  it('featured 글이 있어도 발행 글이 3개면 null이다', async () => {
    const { pickHomeFeatured } = await load();
    expect(pickHomeFeatured({ featuredItems: [featured], totalPublished: 3 })).toBeNull();
  });

  it('featured 글이 있어도 발행 글이 0개·1개면 null이다', async () => {
    const { pickHomeFeatured } = await load();
    expect(pickHomeFeatured({ featuredItems: [featured], totalPublished: 0 })).toBeNull();
    expect(pickHomeFeatured({ featuredItems: [featured], totalPublished: 1 })).toBeNull();
  });

  it('featured 글이 있고 발행 글이 4개면 그 글을 돌려준다(경계)', async () => {
    const { pickHomeFeatured } = await load();
    expect(pickHomeFeatured({ featuredItems: [featured], totalPublished: 4 })).toBe(featured);
  });

  it('featured 글이 있고 발행 글이 4개를 넘으면 그 글을 돌려준다', async () => {
    const { pickHomeFeatured } = await load();
    expect(pickHomeFeatured({ featuredItems: [featured], totalPublished: 13 })).toBe(featured);
  });

  it('featured 글이 여러 개 오면 첫 글만 쓴다', async () => {
    const { pickHomeFeatured } = await load();
    const second = makePost({ slug: 'featured-two' });
    expect(pickHomeFeatured({ featuredItems: [featured, second], totalPublished: 10 })).toBe(
      featured,
    );
  });
});
