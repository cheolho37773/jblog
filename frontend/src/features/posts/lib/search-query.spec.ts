import { describe, expect, it } from 'vitest';

/**
 * M2-09 ① 단계: `/search` 검색어 정규화·2자 판정 순수 함수 계약 (구현 전 작성, 동적 import).
 * 구현자가 만들 모듈: `features/posts/lib/search-query.ts`
 *   parseSearchQuery(raw: string | string[] | undefined) -> { q: string; isSearchable: boolean }
 *     q: 배열이면 첫 값, 앞뒤 공백 제거(값이 없으면 빈 문자열). isSearchable: q 길이가 2 이상일 때만 true(백엔드 §4.2).
 */

type RawValue = string | string[] | undefined;
type Parsed = { q: string; isSearchable: boolean };

async function load() {
  const path = './search-query';
  return (await import(/* @vite-ignore */ path)) as {
    parseSearchQuery: (raw: RawValue) => Parsed;
  };
}

describe('parseSearchQuery: 정규화', () => {
  const cases: [string, RawValue, string][] = [
    ['q가 없으면 빈 문자열', undefined, ''],
    ['빈 문자열', '', ''],
    ['앞뒤 공백은 지운다', '  캐시  ', '캐시'],
    ['탭·줄바꿈도 앞뒤에서 지운다', '\t캐시\n', '캐시'],
    ['가운데 공백은 그대로 둔다', ' Next.js  캐시 ', 'Next.js  캐시'],
    ['공백만이면 빈 문자열', '   ', ''],
    ['배열이면 첫 값을 쓴다', ['캐시', 'docker'], '캐시'],
    ['배열의 첫 값도 앞뒤 공백을 지운다', [' 캐시 ', 'docker'], '캐시'],
    ['빈 배열이면 빈 문자열', [], ''],
  ];
  for (const [name, raw, expected] of cases) {
    it(name, async () => {
      const { parseSearchQuery } = await load();
      expect(parseSearchQuery(raw).q).toBe(expected);
    });
  }

  it('배열의 첫 값이 비어 있으면 다음 값으로 넘어가지 않는다(첫 값만 쓴다)', async () => {
    const { parseSearchQuery } = await load();
    expect(parseSearchQuery(['', 'docker'])).toEqual({ q: '', isSearchable: false });
  });
});

describe('parseSearchQuery: 2자 이상 판정', () => {
  const cases: [string, RawValue, boolean][] = [
    ['없으면 검색하지 않는다', undefined, false],
    ['빈 문자열은 검색하지 않는다', '', false],
    ['공백만이면 검색하지 않는다', '    ', false],
    ['1자는 검색하지 않는다', '가', false],
    ['앞뒤 공백을 뺀 길이가 1이면 검색하지 않는다', '  a  ', false],
    ['2자는 검색한다', '캐시', true],
    ['영문 2자는 검색한다', 'ab', true],
    ['앞뒤 공백을 뺀 길이가 2이면 검색한다', ' 캐시 ', true],
    ['가운데 공백을 포함해 2자 이상이면 검색한다', 'a b', true],
    ['배열이면 첫 값으로 판정한다', ['캐시', 'x'], true],
    ['배열의 첫 값이 1자이면 둘째가 길어도 검색하지 않는다', ['a', 'docker'], false],
  ];
  for (const [name, raw, expected] of cases) {
    it(name, async () => {
      const { parseSearchQuery } = await load();
      expect(parseSearchQuery(raw).isSearchable).toBe(expected);
    });
  }
});
