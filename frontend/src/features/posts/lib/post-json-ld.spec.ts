import { describe, expect, it } from 'vitest';
import type { components } from '@/generated/api-types';
import { makePost } from '../components/post-card.test-data';

/**
 * M2-08 ① 단계: JSON-LD 순수 함수 계약 (구현 전 작성, 동적 import).
 * 구현자가 만들 모듈: `features/posts/lib/post-json-ld.ts` (이름 있는 export)
 *   buildBlogPostingJsonLd(post: InternalPostDto, options: { siteUrl: string }) -> object
 *     '@context'='https://schema.org', '@type'='BlogPosting', headline=title, description=seoDescription ?? excerpt,
 *     datePublished=publishedAt, dateModified=updatedAt, image=절대 주소(문자열 또는 [문자열]; 커버 없으면 키 없음),
 *     url=`{siteUrl}/blog/{slug}`, mainEntityOfPage=url(문자열) 또는 { '@id': url }. `author` 키는 없다.
 *   buildBreadcrumbJsonLd(post: InternalPostDto, options: { siteUrl: string }) -> object
 *     '@type'='BreadcrumbList', itemListElement 3개(position 1~3): Home(`{siteUrl}/`)·Blog(`{siteUrl}/blog`)·글 제목(글 주소)
 *   serializeJsonLd(value: unknown) -> string   JSON 문자열이며 `<`는 `<`로 바뀌어 `</script>`가 남지 않는다
 */

type InternalPostDto = components['schemas']['InternalPostDto'];
type Options = { siteUrl: string };
type Mod = {
  buildBlogPostingJsonLd: (post: InternalPostDto, options: Options) => Record<string, unknown>;
  buildBreadcrumbJsonLd: (post: InternalPostDto, options: Options) => Record<string, unknown>;
  serializeJsonLd: (value: unknown) => string;
};

const load = async () => {
  const path = './post-json-ld';
  return (await import(/* @vite-ignore */ path)) as Mod;
};

const SITE = 'https://blog.example.test';
const OPTIONS = { siteUrl: SITE };
const POST_URL = `${SITE}/blog/hello-world`;

const post = (overrides: Partial<InternalPostDto> = {}): InternalPostDto => ({
  ...makePost(),
  tags: [],
  isFeatured: false,
  seoTitle: null,
  seoDescription: null,
  updatedAt: '2026-02-01T00:00:00.000Z',
  contentMd: '본문',
  version: 1,
  ...overrides,
});

const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : [value]);

describe('buildBlogPostingJsonLd', () => {
  it('BlogPosting의 필수 필드를 채운다', async () => {
    const { buildBlogPostingJsonLd } = await load();
    const ld = buildBlogPostingJsonLd(post(), OPTIONS);
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld['@type']).toBe('BlogPosting');
    expect(ld.headline).toBe('첫 번째 글');
    expect(ld.description).toBe('요약 문장');
    expect(ld.datePublished).toBe('2026-01-04T15:00:00.000Z');
    expect(ld.dateModified).toBe('2026-02-01T00:00:00.000Z');
    expect(ld.url).toBe(POST_URL);
  });

  it('mainEntityOfPage는 글 주소를 가리킨다', async () => {
    const { buildBlogPostingJsonLd } = await load();
    const main = buildBlogPostingJsonLd(post(), OPTIONS).mainEntityOfPage;
    const id = typeof main === 'string' ? main : (main as Record<string, unknown>)['@id'];
    expect(id).toBe(POST_URL);
  });

  it('description은 seoDescription이 있으면 그것을 쓴다', async () => {
    const { buildBlogPostingJsonLd } = await load();
    const ld = buildBlogPostingJsonLd(post({ seoDescription: 'SEO 설명' }), OPTIONS);
    expect(ld.description).toBe('SEO 설명');
  });

  it('커버가 있으면 image를 절대 주소로 낸다', async () => {
    const { buildBlogPostingJsonLd } = await load();
    const ld = buildBlogPostingJsonLd(post({ coverImageUrl: '/uploads/fixtures/a.png' }), OPTIONS);
    expect(asList(ld.image)).toEqual([`${SITE}/uploads/fixtures/a.png`]);
  });

  it('커버가 없으면 image 키가 없다', async () => {
    const { buildBlogPostingJsonLd } = await load();
    const ld = buildBlogPostingJsonLd(post({ coverImageUrl: null }), OPTIONS);
    expect('image' in ld).toBe(false);
  });

  it('author 키를 넣지 않는다(프로필 API는 M4, 개인정보를 코드에 쓰지 않는다)', async () => {
    const { buildBlogPostingJsonLd } = await load();
    expect('author' in buildBlogPostingJsonLd(post(), OPTIONS)).toBe(false);
  });
});

describe('buildBreadcrumbJsonLd', () => {
  it('Home → Blog → 글 제목 3단계이고 position이 1부터 이어진다', async () => {
    const { buildBreadcrumbJsonLd } = await load();
    const ld = buildBreadcrumbJsonLd(post(), OPTIONS);
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld['@type']).toBe('BreadcrumbList');
    const items = ld.itemListElement as Array<Record<string, unknown>>;
    expect(items.map((item) => item.position)).toEqual([1, 2, 3]);
    expect(items.map((item) => item.name)).toEqual(['Home', 'Blog', '첫 번째 글']);
    expect(items.map((item) => item.item)).toEqual([`${SITE}/`, `${SITE}/blog`, POST_URL]);
    expect(items.every((item) => item['@type'] === 'ListItem')).toBe(true);
  });
});

describe('serializeJsonLd', () => {
  it('JSON으로 되돌려 파싱하면 원래 값과 같다', async () => {
    const { serializeJsonLd } = await load();
    const value = { a: 1, b: ['한글', 'x'], c: { d: null } };
    expect(JSON.parse(serializeJsonLd(value))).toEqual(value);
  });

  it('제목에 </script>가 있어도 문자열에 `<`가 남지 않아 스크립트를 탈출하지 못한다', async () => {
    const { buildBlogPostingJsonLd, serializeJsonLd } = await load();
    const title = '</script><script>alert(1)</script>';
    const out = serializeJsonLd(buildBlogPostingJsonLd(post({ title }), OPTIONS));
    expect(out).not.toContain('<');
    expect(out.toLowerCase()).not.toContain('</script');
    expect((JSON.parse(out) as { headline: string }).headline).toBe(title);
  });

  it('`<`는 \\u003c로 바뀐다', async () => {
    const { serializeJsonLd } = await load();
    expect(serializeJsonLd({ t: '<b>' })).toContain('\\u003c');
  });
});
