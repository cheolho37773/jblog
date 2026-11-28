import type { ComponentProps } from 'react';

// 본문 이미지는 next/image가 아니라 일반 <img>를 쓴다 (개발자 결정 G2, 2026-11-26).
// 운영에서는 Nginx가 /uploads를 제공해 Next 최적화기(/_next/image)가 원본을 가져오지 못하고 404가 난다.
// 크기·WebP 변환은 업로드 시 백엔드가 맡는다 (M3). 폭 100%·radius는 .prose-jblog img(prose-jblog.css)가 정한다.
export function MdImage({ src, alt, ...props }: ComponentProps<'img'>) {
  // alt가 없으면 빈 alt(장식 이미지)로 둔다. 경고는 내지 않는다 (지시서 규약 5).

  return (
    <img {...props} src={src} alt={alt ?? ''} loading="lazy" decoding="async" draggable={false} />
  );
}
