// 저장된 excerpt가 없을 때 본문에서 만드는 요약 (백엔드 §3.2: 본문 앞 160자).
export const AUTO_EXCERPT_LENGTH = 160;

// 여는 펜스와 같은 종류(``` 또는 ~~~)의 닫는 펜스까지 통째로 매칭한다.
const FENCED_CODE_BLOCK = /^(```|~~~)[\s\S]*?^\1/gm;

// 밑줄 강조는 단어 경계에서만 인정한다. 단어 안 밑줄(snake_case)은 앞뒤가 영숫자라 매칭되지 않는다.
const UNDERSCORE_EMPHASIS = /(?<![A-Za-z0-9])(_{1,2})(?=\S)([^\n]*?\S)\1(?![A-Za-z0-9])/g;

// 순서가 중요하다: 코드 블록·이미지를 먼저 통째로 빼고, 링크를 문구만 남긴 뒤 남은 기호를 걷는다.
const MARKDOWN_STRIPPERS: ReadonlyArray<readonly [RegExp, string]> = [
  [FENCED_CODE_BLOCK, ' '], // 코드 블록(``` 또는 ~~~)은 요약으로 쓸모가 없다
  [/!\[[^\]]*\]\([^)]*\)/g, ' '], // 이미지
  [/\[([^\]]*)\]\([^)]*\)/g, '$1'], // 링크는 문구만 남긴다
  [/^\s{0,3}#{1,6}\s+/gm, ''], // 헤딩
  [/^\s*>\s?(\[![A-Z]+\])?/gm, ''], // 인용·콜아웃 표시
  [/^\s*([-*+]|\d+\.)\s+/gm, ''], // 목록 기호
  [UNDERSCORE_EMPHASIS, '$2'], // _x_, __x__ 강조는 글자만 남긴다
  [/[*`~]/g, ''], // 별표 강조·인라인 코드·취소선
];

export function buildAutoExcerpt(contentMd: string): string {
  const plain = MARKDOWN_STRIPPERS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    contentMd,
  );
  return plain.replace(/\s+/g, ' ').trim().slice(0, AUTO_EXCERPT_LENGTH);
}
