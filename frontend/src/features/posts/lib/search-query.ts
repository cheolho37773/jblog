// 백엔드 검색은 2자 미만이면 400을 낸다(백엔드 §4.2). 호출 전에 막아 안내로 바꾼다.
export const MIN_SEARCH_LENGTH = 2;

export type ParsedSearchQuery = { q: string; isSearchable: boolean };

/** `/search?q=`의 값을 정규화한다. 배열이면 첫 값만 쓰고(비어 있어도 다음 값으로 넘어가지 않는다) 앞뒤 공백을 지운다. */
export function parseSearchQuery(raw: string | string[] | undefined): ParsedSearchQuery {
  const first = Array.isArray(raw) ? raw[0] : raw;
  const q = (first ?? '').trim();
  return { q, isSearchable: q.length >= MIN_SEARCH_LENGTH };
}
