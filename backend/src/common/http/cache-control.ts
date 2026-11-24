// 응답 유형별 Cache-Control 값 (백엔드 §5.7-①).
// 공개 조회 응답은 CDN·브라우저가 잠깐 재사용해도 되고, 오류·리다이렉트는 절대 캐시하지 않는다.
export const CACHE_CONTROL_PUBLIC = 'public, max-age=60, stale-while-revalidate=300';
export const CACHE_CONTROL_SEARCH = 'public, max-age=30';
// 오류를 캐시하면 글이 발행된 뒤에도 404가 남고, 301을 캐시하면 slug가 바뀐 뒤에도 옛 경로로 보낸다.
export const CACHE_CONTROL_NO_STORE = 'no-store';
