import type { components } from '@/generated/api-types';
import {
  buildBlogPostingJsonLd,
  buildBreadcrumbJsonLd,
  serializeJsonLd,
} from '../lib/post-json-ld';

type InternalPostDto = components['schemas']['InternalPostDto'];

/** 글 상세 구조화 데이터 2종. 서버에서만 그린다(원문은 넘기지 않고 메타 필드만 쓴다). */
export function PostJsonLd({ post, siteUrl }: { post: InternalPostDto; siteUrl: string }) {
  const items = [
    buildBlogPostingJsonLd(post, { siteUrl }),
    buildBreadcrumbJsonLd(post, { siteUrl }),
  ];
  return items.map((item) => (
    <script
      key={String(item['@type'])}
      type="application/ld+json"
      // serializeJsonLd가 `<`를 이스케이프해 값이 스크립트를 닫지 못한다.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(item) }}
    />
  ));
}
