import { render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { describe, expect, it } from 'vitest';

/** M2-07 ① 단계: TagFilterChip 계약 (구현 전 작성, 동적 import). `{ tagName }` → `a[href="/blog"]`, 이름 `#{tagName} 필터 해제`. */

async function renderChip(tagName: string) {
  const path = './TagFilterChip';
  const { TagFilterChip } = (await import(/* @vite-ignore */ path)) as {
    TagFilterChip: ComponentType<{ tagName: string }>;
  };
  return render(<TagFilterChip tagName={tagName} />);
}

describe('TagFilterChip', () => {
  it('이름이 "#태그명 필터 해제"인 링크 1개이고 /blog로 간다', async () => {
    await renderChip('Next.js');
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(screen.getByRole('link', { name: '#Next.js 필터 해제' })).toHaveAttribute(
      'href',
      '/blog',
    );
  });

  it('한글 태그명도 이름에 그대로 들어간다', async () => {
    await renderChip('캐시');
    expect(screen.getByRole('link', { name: '#캐시 필터 해제' })).toBeInTheDocument();
  });

  it('✕ 아이콘은 aria-hidden이라 이름에 섞이지 않는다', async () => {
    const { container } = await renderChip('NestJS');
    const hidden = container.querySelectorAll('a [aria-hidden="true"]');
    expect(hidden.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('link')).toHaveAccessibleName('#NestJS 필터 해제');
  });

  it('태그 링크에는 category·page 쿼리가 붙지 않는다', async () => {
    await renderChip('NestJS');
    expect(screen.getByRole('link').getAttribute('href')).not.toContain('?');
  });
});
