import type { Blockquote, Paragraph, Root } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

// GitHub 형식 콜아웃: `> [!NOTE]` + 다음 줄부터 내용 (지시서 "문법 확정").
// 종류는 대소문자를 구분하지 않고, 모르는 종류는 일반 인용문으로 둔다.
export const CALLOUT_LABELS = {
  note: '참고',
  tip: '팁',
  important: '중요',
  warning: '주의',
  caution: '경고',
} as const;

type CalloutKind = keyof typeof CALLOUT_LABELS;

// `[!KIND]` 뒤의 공백·줄바꿈 하나까지 표시 문자열로 보고 걷어낸다.
const CALLOUT_MARKER = /^\[!([A-Za-z]+)\][ \t]*(?:\r?\n)?/;

function isCalloutKind(value: string): value is CalloutKind {
  // `in`은 constructor·toString 같은 상속 이름도 참이 되므로 자기 속성만 허용한다.
  return Object.hasOwn(CALLOUT_LABELS, value);
}

function findMarker(blockquote: Blockquote) {
  const paragraph = blockquote.children[0];
  if (paragraph?.type !== 'paragraph') return undefined;
  const text = paragraph.children[0];
  if (text?.type !== 'text') return undefined;

  const match = CALLOUT_MARKER.exec(text.value);
  const kind = match?.[1]?.toLowerCase();
  if (!match || !kind || !isCalloutKind(kind)) return undefined;
  return { paragraph, text, kind, markerLength: match[0].length };
}

function removeMarker(blockquote: Blockquote, marker: NonNullable<ReturnType<typeof findMarker>>) {
  const { paragraph, text, markerLength } = marker;
  text.value = text.value.slice(markerLength);
  if (text.value === '') paragraph.children.shift();
  if (paragraph.children.length === 0) blockquote.children.shift();
}

function titleParagraph(label: string): Paragraph {
  return {
    type: 'paragraph',
    data: { hName: 'p', hProperties: { dataCalloutTitle: '' } },
    children: [{ type: 'text', value: label }],
  };
}

/** 콜아웃 인용문을 `<aside role="note" aria-label="참고">`로 바꾸고 제목 줄을 맨 앞에 붙인다. */
export const remarkCallout: Plugin<[], Root> = () => (tree) => {
  visit(tree, 'blockquote', (blockquote) => {
    const marker = findMarker(blockquote);
    if (!marker) return;

    const label = CALLOUT_LABELS[marker.kind];
    removeMarker(blockquote, marker);
    blockquote.children.unshift(titleParagraph(label));
    blockquote.data = {
      hName: 'aside',
      hProperties: { role: 'note', ariaLabel: label, dataCallout: marker.kind },
    };
  });
};
