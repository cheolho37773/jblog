/**
 * 글 주소 계산을 한 곳에 모은다. 링크 복사·JSON-LD가 같은 함수를 써서, canonical(루트 metadataBase가
 * `new URL`로 절대 주소를 만든다)과 항상 같은 값이 된다. 문자열 이어 붙이기는 사이트 주소 끝에 `/`가 있으면 `//blog/…`가 된다.
 */
export function postAbsoluteUrl(slug: string, siteUrl: string): string {
  return new URL(`/blog/${slug}`, siteUrl).toString();
}

/** 외부 링크 판정의 기준 오리진. 사이트 주소에 경로나 끝 `/`가 있어도 오리진만 남긴다. */
export function siteOrigin(siteUrl: string): string {
  return new URL(siteUrl).origin;
}
