import { describe, expect, it } from 'vitest';
import type { components } from '@/generated/api-types';
import { makePost } from '../components/post-card.test-data';
import { buildBlogPostingJsonLd, buildBreadcrumbJsonLd } from './post-json-ld';

// Codex r1 #1 회귀(현재 통과해야 하는 고정 테스트): 사이트 주소 끝 `/`가 있어도 JSON-LD 주소에 `//`가 생기지 않는다.
type InternalPostDto = components['schemas']['InternalPostDto'];

const post: InternalPostDto = {
  ...makePost(),
  slug: 'x',
  coverImageUrl: '/uploads/cover.png',
  tags: [],
  isFeatured: false,
  seoTitle: null,
  seoDescription: null,
  updatedAt: '2026-02-01T00:00:00.000Z',
  contentMd: '본문',
  version: 1,
};

const urlsIn = (value: unknown): string[] => JSON.stringify(value).match(/https?:\/\/[^"]+/g) ?? [];

describe.each(['https://example.com', 'https://example.com/'])('사이트 주소 %s', (siteUrl) => {
  it('BlogPosting의 url·mainEntityOfPage·image는 //가 없는 같은 주소다', () => {
    const ld = buildBlogPostingJsonLd(post, { siteUrl });
    expect(ld.url).toBe('https://example.com/blog/x');
    expect(JSON.stringify(ld.mainEntityOfPage)).toContain('https://example.com/blog/x');
    for (const url of urlsIn(ld).filter((u) => !u.startsWith('https://schema.org'))) {
      expect(url.replace('https://', ''), url).not.toContain('//');
    }
  });

  it('BreadcrumbList의 Home·Blog·글 주소에 //가 없다', () => {
    const items = (
      buildBreadcrumbJsonLd(post, { siteUrl }).itemListElement as { item: string }[]
    ).map((crumb) => crumb.item);
    expect(items).toEqual([
      'https://example.com/',
      'https://example.com/blog',
      'https://example.com/blog/x',
    ]);
  });
});
