import { render, screen, within } from '@testing-library/react';
import type { ComponentType } from 'react';
import { describe, expect, it } from 'vitest';
import { makePost, type PostSummaryDto } from './post-card.test-data';

/**
 * M2-06 ① 단계: PostCardGrid·PostCardOverlay·FeaturedHeroCard 공통 계약 (지시서 "표시 규칙"·인터페이스 표).
 * 구현 전에 쓴 테스트라 동적 import로 불러온다. 가정: 각 파일의 이름 있는 export가 컴포넌트 이름과 같다.
 */

interface CardProps {
  post: PostSummaryDto;
  headingLevel?: 1 | 2 | 3;
}
type CardName = 'PostCardGrid' | 'PostCardOverlay' | 'FeaturedHeroCard';

async function renderCard(name: CardName, post: PostSummaryDto, headingLevel?: 1 | 2 | 3) {
  const path = `./${name}`;
  const mod = (await import(/* @vite-ignore */ path)) as Record<string, ComponentType<CardProps>>;
  const Card = mod[name];
  if (!Card) throw new Error(`${name} export가 없다`);
  return render(<Card post={post} headingLevel={headingLevel} />);
}

const CARDS: { name: CardName; defaultLevel: number; badgeClass: string }[] = [
  { name: 'PostCardGrid', defaultLevel: 3, badgeClass: 'bg-primary-soft' },
  { name: 'PostCardOverlay', defaultLevel: 2, badgeClass: 'bg-primary-strong' },
  { name: 'FeaturedHeroCard', defaultLevel: 2, badgeClass: 'bg-primary-strong' },
];

describe.each(CARDS)('$name 공통 계약', ({ name, defaultLevel, badgeClass }) => {
  it('카드 전체가 /blog/{slug} 링크 하나이고 접근 가능한 이름은 제목이다', async () => {
    await renderCard(name, makePost({ title: '카드 제목', slug: 'my-post' }));
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(screen.getByRole('link', { name: '카드 제목' })).toHaveAttribute(
      'href',
      '/blog/my-post',
    );
  });

  it('링크 안에 링크가 중첩되지 않는다 (카테고리 배지는 링크가 아니다)', async () => {
    const { container } = await renderCard(name, makePost());
    expect(container.querySelector('a a')).toBeNull();
    expect(container.querySelectorAll('a')).toHaveLength(1);
  });

  it('제목은 기본 헤딩 단계로 렌더되고 headingLevel로 바꿀 수 있다', async () => {
    const first = await renderCard(name, makePost({ title: '기본 제목' }));
    expect(screen.getByRole('heading', { level: defaultLevel, name: '기본 제목' })).toBeVisible();
    first.unmount();

    const level = name === 'PostCardGrid' ? 2 : 1;
    await renderCard(name, makePost({ title: '바꾼 제목' }), level);
    expect(screen.getByRole('heading', { level, name: '바꾼 제목' })).toBeVisible();
  });

  it('카테고리 배지를 보여 주고 variant가 기획대로다', async () => {
    await renderCard(name, makePost({ category: { name: '백엔드', slug: 'backend' } }));
    const badge = screen.getByText('백엔드');
    expect(badge.className).toContain(badgeClass);
  });

  it('카테고리가 null이면 배지를 그리지 않는다', async () => {
    const { container } = await renderCard(name, makePost({ category: null }));
    expect(screen.queryByText('백엔드')).not.toBeInTheDocument();
    expect(
      container.querySelector('[class*="bg-primary-soft"], [class*="bg-primary-strong"]'),
    ).toBeNull();
  });

  it('날짜는 Asia/Seoul 기준이고 dateTime은 원래 ISO 값이다 (UTC 15:00 경계)', async () => {
    const iso = '2026-01-04T15:00:00.000Z';
    const { container } = await renderCard(name, makePost({ publishedAt: iso }));
    expect(screen.getByText('2026.01.05')).toBeInTheDocument();
    expect(container.querySelector('time')).toHaveAttribute('datetime', iso);
  });

  it('읽는 시간을 보여 주고 1 이하는 1 min read다', async () => {
    const first = await renderCard(name, makePost({ readingMinutes: 7 }));
    expect(screen.getByText('7 min read')).toBeInTheDocument();
    first.unmount();
    await renderCard(name, makePost({ readingMinutes: 0 }));
    expect(screen.getByText('1 min read')).toBeInTheDocument();
  });

  it('색은 hex 없이 토큰 유틸만 쓴다', async () => {
    const { container } = await renderCard(name, makePost());
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});

describe('PostCardGrid', () => {
  it('article 안에 링크가 있고 구조가 article > a 이다', async () => {
    const { container } = await renderCard('PostCardGrid', makePost());
    const article = screen.getByRole('article');
    expect(within(article).getByRole('link')).toBeInTheDocument();
    expect(container.querySelector('article > a')).not.toBeNull();
  });

  it('커버가 있으면 장식 이미지(alt 빈 문자열, lazy, async 디코딩)를 일반 img로 그린다', async () => {
    const { container } = await renderCard(
      'PostCardGrid',
      makePost({ coverImageUrl: '/uploads/fixtures/cover-rose.png' }),
    );
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('src', '/uploads/fixtures/cover-rose.png');
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
  });

  it('커버가 없으면 img 없이 같은 비율의 bg-subtle 자리 표시만 있다', async () => {
    const { container } = await renderCard('PostCardGrid', makePost({ coverImageUrl: null }));
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[class*="bg-subtle"]')).not.toBeNull();
  });

  it('제목은 최대 3줄로 자른다 (line-clamp-3)', async () => {
    await renderCard('PostCardGrid', makePost({ title: '아주 긴 제목 '.repeat(20) }));
    expect(screen.getByRole('heading', { level: 3 }).className).toContain('line-clamp-3');
  });

  it('썸네일은 장식이라 접근성 트리에 img 역할로 노출되지 않는다', async () => {
    await renderCard('PostCardGrid', makePost());
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

describe('PostCardOverlay · FeaturedHeroCard', () => {
  it.each(['PostCardOverlay', 'FeaturedHeroCard'] as const)(
    '%s는 제목 글자가 on-primary 토큰이다',
    async (name) => {
      await renderCard(name, makePost());
      const title = screen.getByRole('heading');
      if (name === 'PostCardOverlay') expect(title.className).toContain('text-on-primary');
      // FeaturedHero 제목은 흰 플로팅 카드(surface) 위라 text-strong이다. 오버레이 글자 규칙은 Overlay에만 해당.
      else expect(title.className).toContain('text-strong');
    },
  );

  it('PostCardOverlay의 메타 글자도 on-primary다 (AuthorMeta onImage)', async () => {
    const { container } = await renderCard('PostCardOverlay', makePost());
    expect(container.querySelector('time')?.parentElement?.className).toMatch(/text-on-primary/);
  });

  it('커버가 없어도 깨지지 않고 링크·제목이 남는다', async () => {
    for (const name of ['PostCardOverlay', 'FeaturedHeroCard'] as const) {
      const { unmount } = await renderCard(
        name,
        makePost({ coverImageUrl: null, title: '표지 없음' }),
      );
      expect(screen.getByRole('link', { name: '표지 없음' })).toBeInTheDocument();
      unmount();
    }
  });
});
