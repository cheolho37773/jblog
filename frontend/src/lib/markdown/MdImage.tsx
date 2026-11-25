import type { ComponentProps } from 'react';

// 임시 구현(M2-05 ②, 보류): next/image 최적화 경로가 standalone + Nginx(/uploads/*는 Nginx가 제공) 구성에서
// 성립하는지 확인한 결과를 보고한 뒤 결정한다. 그때까지는 <img> 하나로 지시서 규약 5의 겉모습(폭 100%·지연 로딩·alt)만 지킨다.
export function MdImage({ src, alt, ...props }: ComponentProps<'img'>) {
  // alt가 없으면 빈 alt(장식 이미지)로 둔다. 경고는 내지 않는다 (지시서 규약 5).
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} src={src} alt={alt ?? ''} loading="lazy" decoding="async" />;
}
