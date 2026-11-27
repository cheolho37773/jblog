import type { Metadata } from 'next';
import type { components } from '@/generated/api-types';

type InternalPostDto = components['schemas']['InternalPostDto'];

/**
 * 글 상세 메타데이터 (프론트엔드 §6.3·§9). 주소는 상대 경로로 두고 루트 metadataBase가 절대 주소로 바꾼다.
 * title은 루트 템플릿(`%s | jblog`)이 붙고, og:title은 템플릿 없이 글 제목만 쓴다.
 * 커버가 없으면 이미지 없이 Twitter `summary` 카드다(동적 OG 이미지는 M5).
 */
export function buildPostMetadata(post: InternalPostDto): Metadata {
  const title = post.seoTitle ?? post.title;
  const description = post.seoDescription ?? post.excerpt;
  const canonical = `/blog/${post.slug}`;
  const images = post.coverImageUrl ? [post.coverImageUrl] : undefined;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'article',
      url: canonical,
      title,
      description,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      images,
    },
    twitter: {
      card: images ? 'summary_large_image' : 'summary',
      title,
      description,
      images,
    },
  };
}
