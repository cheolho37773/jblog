// 저장된 excerpt가 없을 때 본문에서 만드는 요약 (백엔드 §3.2: 본문 앞 160자).
export const AUTO_EXCERPT_LENGTH = 160;

// 순서가 중요하다: 코드 블록·이미지를 먼저 통째로 빼고, 링크를 문구만 남긴 뒤 남은 기호를 걷는다.
const MARKDOWN_STRIPPERS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^```[\s\S]*?^```/gm, ' '], // 코드 블록은 요약으로 쓸모가 없다
  [/!\[[^\]]*\]\([^)]*\)/g, ' '], // 이미지
  [/\[([^\]]*)\]\([^)]*\)/g, '$1'], // 링크는 문구만 남긴다
  [/^\s{0,3}#{1,6}\s+/gm, ''], // 헤딩
  [/^\s*>\s?(\[![A-Z]+\])?/gm, ''], // 인용·콜아웃 표시
  [/^\s*([-*+]|\d+\.)\s+/gm, ''], // 목록 기호
  [/[*`~]/g, ''], // 강조·인라인 코드·취소선
];

export function buildAutoExcerpt(contentMd: string): string {
  const plain = MARKDOWN_STRIPPERS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    contentMd,
  );
  return plain.replace(/\s+/g, ' ').trim().slice(0, AUTO_EXCERPT_LENGTH);
}
