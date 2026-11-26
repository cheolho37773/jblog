import { render, screen, within } from '@testing-library/react';
import type { ComponentType } from 'react';
import { describe, expect, it } from 'vitest';
import type { CategoryWithCountDto } from './post-card.test-data';

/** M2-06 ① 단계: CategoryChips·PostCardSkeleton 계약 (구현 전 작성, 동적 import). */

interface ChipsProps {
  categories: CategoryWithCountDto[];
  activeSlug?: string;
}
const CATEGORIES: CategoryWithCountDto[] = [
  { name: '백엔드', slug: 'backend', postCount: 12 },
  { name: '프론트엔드', slug: 'frontend', postCount: 3 },
];

async function renderChips(activeSlug?: string) {
  const path = './CategoryChips';
  const { CategoryChips } = (await import(/* @vite-ignore */ path)) as {
    CategoryChips: ComponentType<ChipsProps>;
  };
  return render(<CategoryChips categories={CATEGORIES} activeSlug={activeSlug} />);
}

describe('CategoryChips', () => {
  it('nav 랜드마크 "카테고리" 안에 링크 칩이 있다', async () => {
    await renderChips();
    const nav = screen.getByRole('navigation', { name: '카테고리' });
    expect(within(nav).getAllByRole('link')).toHaveLength(3);
  });

  it('첫 칩은 All이고 /blog로 간다', async () => {
    await renderChips();
    const links = within(screen.getByRole('navigation', { name: '카테고리' })).getAllByRole('link');
    expect(links[0]).toHaveTextContent(/^All$/);
    expect(links[0]).toHaveAttribute('href', '/blog');
  });

  it('각 칩은 /blog?category={slug}로 간다', async () => {
    await renderChips();
    expect(screen.getByRole('link', { name: '백엔드' })).toHaveAttribute(
      'href',
      '/blog?category=backend',
    );
    expect(screen.getByRole('link', { name: '프론트엔드' })).toHaveAttribute(
      'href',
      '/blog?category=frontend',
    );
  });

  it('이름 옆에 글 수를 넣지 않는다', async () => {
    await renderChips();
    expect(screen.getByRole('link', { name: '백엔드' })).toHaveTextContent(/^백엔드$/);
    expect(screen.queryByText(/12/)).not.toBeInTheDocument();
  });

  it('activeSlug가 없으면 All이 선택(aria-current=page, solid)이고 나머지는 soft다', async () => {
    await renderChips();
    const all = screen.getByRole('link', { name: 'All' });
    expect(all).toHaveAttribute('aria-current', 'page');
    expect(all.className).toContain('bg-primary-strong');
    const other = screen.getByRole('link', { name: '백엔드' });
    expect(other).not.toHaveAttribute('aria-current');
    expect(other.className).toContain('bg-primary-soft');
  });

  it('activeSlug인 칩만 aria-current=page이고 solid이며 All은 soft다', async () => {
    await renderChips('frontend');
    const active = screen.getByRole('link', { name: '프론트엔드' });
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(active.className).toContain('bg-primary-strong');
    expect(screen.getAllByRole('link').filter((l) => l.getAttribute('aria-current'))).toHaveLength(
      1,
    );
    expect(screen.getByRole('link', { name: 'All' }).className).toContain('bg-primary-soft');
    expect(screen.getByRole('link', { name: '백엔드' }).className).toContain('bg-primary-soft');
  });
});

describe('PostCardSkeleton', () => {
  it('aria-hidden이라 접근성 트리에 나타나지 않는다', async () => {
    const path = './PostCardSkeleton';
    const { PostCardSkeleton } = (await import(/* @vite-ignore */ path)) as {
      PostCardSkeleton: ComponentType;
    };
    const { container } = render(<PostCardSkeleton />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(container.innerHTML).toMatch(/bg-subtle/);
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
