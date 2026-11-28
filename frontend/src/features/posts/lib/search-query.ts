// 백엔드 검색은 2자 미만이면 400을 낸다(백엔드 §4.2). 호출 전에 막아 안내로 바꾼다.
export const MIN_SEARCH_LENGTH = 2;

export type ParsedSearchQuery = { q: string; isSearchable: boolean };

// 아래 두 정규식과 길이 계산은 백엔드 `@MinLength(2)`(class-validator → validator.js `isLength`)와 한 글자도 다르면 안 된다.
// 다르면 프론트는 통과시키고 백엔드는 400을 내서, 안내여야 할 입력이 오류 화면이 된다(예: 이모지 1자).
// 원본: validator@13.15.35 `lib/isLength.js` 23~25행. 프론트는 backend를 import할 수 없어 같은 계산을 옮겼다.
const PRESENTATION_SEQUENCE = /[^️︎][️︎]/g;
const SURROGATE_PAIR = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;

function validatorLength(text: string): number {
  const presentationSequences = text.match(PRESENTATION_SEQUENCE) ?? [];
  const surrogatePairs = text.match(SURROGATE_PAIR) ?? [];
  return text.length - presentationSequences.length - surrogatePairs.length;
}

/** `/search?q=`의 값을 정규화한다. 배열이면 첫 값만 쓰고(비어 있어도 다음 값으로 넘어가지 않는다) 앞뒤 공백을 지운다. */
export function parseSearchQuery(raw: string | string[] | undefined): ParsedSearchQuery {
  const first = Array.isArray(raw) ? raw[0] : raw;
  const q = (first ?? '').trim();
  return { q, isSearchable: validatorLength(q) >= MIN_SEARCH_LENGTH };
}
