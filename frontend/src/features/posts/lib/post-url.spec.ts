import { describe, expect, it } from 'vitest';
import { postAbsoluteUrl, siteOrigin } from './post-url';

// Codex r1 #1 회귀: 사이트 주소 끝의 `/` 유무와 관계없이 링크 복사·canonical·JSON-LD가 같은 글 주소를 쓴다.
// 계약: features/posts/lib/post-url.ts
//   postAbsoluteUrl(slug: string, siteUrl: string): string   -> `new URL('/blog/{slug}', siteUrl)` 기준 절대 주소(`//` 없음)
//   siteOrigin(siteUrl: string): string                       -> 오리진만(끝 `/` 제거). 상세가 renderMarkdown의 siteOrigin으로 넘긴다.
// 경로가 붙은 사이트 주소(예: https://example.com/base/)는 공개 환경 스키마가 막으므로(env.site-url.spec.ts) 여기서는 다루지 않는다.
const EXPECTED = 'https://example.com/blog/x';

describe('postAbsoluteUrl', () => {
  it.each(['https://example.com', 'https://example.com/'])(
    '사이트 주소 %s에서 https://example.com/blog/x를 돌려준다',
    (siteUrl) => {
      expect(postAbsoluteUrl('x', siteUrl)).toBe(EXPECTED);
    },
  );

  it('결과에 프로토콜 뒤를 제외한 연속 슬래시(//)가 없다', () => {
    expect(postAbsoluteUrl('x', 'https://example.com/').replace('https://', '')).not.toContain(
      '//',
    );
  });

  it('포트가 있는 사이트 주소도 유지한다', () => {
    expect(postAbsoluteUrl('x', 'http://localhost:3200/')).toBe('http://localhost:3200/blog/x');
  });
});

describe('siteOrigin', () => {
  it.each([
    ['https://example.com', 'https://example.com'],
    ['https://example.com/', 'https://example.com'],
    ['http://localhost:3200/', 'http://localhost:3200'],
  ])('%s -> %s', (siteUrl, origin) => {
    expect(siteOrigin(siteUrl)).toBe(origin);
  });
});
