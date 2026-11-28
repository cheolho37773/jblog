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

// 백엔드 `@MinLength(2)`(class-validator → validator@13.15.35 `isLength`)와 같은 판정이어야 한다.
// 프론트 테스트에서 backend 패키지를 import할 수 없어 기대값을 표로 고정했다. 표의 `backend` 열은
// `backend/`에서 `node -e "console.log(require('class-validator').minLength(입력, 2))"`로 얻은 값이다(대조 방법).
// 계산: str.length - (변형 선택자 U+FE0E·U+FE0F 수) - (서로게이트 쌍 수). 앞뒤 공백은 먼저 지운다(백엔드 trimString).
describe('parseSearchQuery: 백엔드 minLength(2)와 같은 길이 계산 (Codex r1)', () => {
  const table: [string, string, boolean][] = [
    ['이모지 1자(서로게이트 쌍)', '😀', false],
    ['변형 선택자가 붙은 1자', '❤️', false],
    ['앞뒤 공백 + 이모지 1자', '  😀  ', false],
    ['앞뒤 공백 + 변형 선택자 1자', ' ❤️ ', false],
    ['변형 선택자(텍스트형) 붙은 영문 1자', 'a\uFE0E', false],
    ['BMP 기호 1자', '❤', false],
    ['한글 1자', '한', false],
    ['영문 1자', 'a', false],
    ['이모지 2자', '😀😀', true],
    ['변형 선택자 붙은 2자', '❤️❤️', true],
    ['이모지 + 영문', '😀a', true],
    ['변형 선택자 붙은 1자 + 영문', '❤️a', true],
    ['한글 2자', '가나', true],
    ['영문 2자', 'ab', true],
    ['결합 문자(A + 고리)는 2로 센다', 'A\u030A', true],
    ['국기(지역 표시 기호 2개)', '🇰🇷', true],
    ['피부색 이모지(이모지 + 수정자)', '👍🏽', true],
  ];
  for (const [name, raw, expected] of table) {
    it(`${name} ${JSON.stringify(raw)} → 검색 ${expected ? '가능' : '불가'}`, async () => {
      const { parseSearchQuery } = await load();
      expect(parseSearchQuery(raw).isSearchable).toBe(expected);
    });
  }

  it('이모지 1자는 q를 그대로 돌려주되 검색하지 않는다', async () => {
    const { parseSearchQuery } = await load();
    expect(parseSearchQuery(' 😀 ')).toEqual({ q: '😀', isSearchable: false });
  });
});
