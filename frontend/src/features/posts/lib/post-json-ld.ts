import type { components } from '@/generated/api-types';

type InternalPostDto = components['schemas']['InternalPostDto'];
type JsonLdOptions = { siteUrl: string };
type JsonLd = Record<string, unknown>;

const SCHEMA_CONTEXT = 'https://schema.org';

const absoluteUrl = (path: string, siteUrl: string) => new URL(path, siteUrl).toString();
const postUrl = (post: InternalPostDto, siteUrl: string) =>
  absoluteUrl(`/blog/${post.slug}`, siteUrl);

/**
 * 글 상세의 `BlogPosting` 구조화 데이터 (프론트엔드 §9).
 * author는 프로필 API(M4)가 생긴 뒤 넣는다. 개인정보를 코드에 쓰지 않는다.
 */
export function buildBlogPostingJsonLd(post: InternalPostDto, { siteUrl }: JsonLdOptions): JsonLd {
  const url = postUrl(post, siteUrl);
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.seoDescription ?? post.excerpt,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    ...(post.coverImageUrl && { image: [absoluteUrl(post.coverImageUrl, siteUrl)] }),
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  };
}

/** Home → Blog → 글 제목 경로 (`BreadcrumbList`). */
export function buildBreadcrumbJsonLd(post: InternalPostDto, { siteUrl }: JsonLdOptions): JsonLd {
  const crumbs = [
    { name: 'Home', item: absoluteUrl('/', siteUrl) },
    { name: 'Blog', item: absoluteUrl('/blog', siteUrl) },
    { name: post.title, item: postUrl(post, siteUrl) },
  ];
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      ...crumb,
    })),
  };
}

/**
 * `<script type="application/ld+json">` 안에 넣을 문자열.
 * 제목 같은 값에 `</script>`가 있어도 스크립트를 닫지 못하게 `<`를 JSON 이스케이프(<)로 바꾼다. 파싱 결과는 같다.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}
