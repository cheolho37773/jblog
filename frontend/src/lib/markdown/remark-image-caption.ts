import type {
  Image,
  LinkReference,
  Link,
  Paragraph,
  PhrasingContent,
  Root,
  TableCell,
} from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

// `![alt](url "캡션")`: 제목 속성이 있으면 캡션이다 (지시서 "문법 확정", r4 "캡션 위치 일괄 점검표").
// 위치별 규칙:
// - 문단(최상위·목록·인용·콜아웃 안): 캡션 이미지를 경계로 문단을 나누고 이미지는 블록 figure로 올린다.
// - 링크·참조 링크·강조·굵게·취소선 안(중첩 포함): 같은 경계에서 나누고, 앞뒤 조각은 감싸던 서식을
//   복제해 남기며, 이미지가 링크 안이었다면 figure 안에서 같은 링크로 감싼다.
// - 표 셀: 셀은 phrasing을 직접 갖지만 HTML `td`는 flow 콘텐츠(figure 포함)를 허용한다. 그래서 셀 안에서
//   같은 분할을 하고 figure를 셀 안에 둔다. 앞뒤 글자는 셀 안 phrasing으로 유지해 행·열 구조는 그대로다.
// - 헤딩: 제목 줄에 블록을 둘 수 없으므로 figure를 만들지 않는다. 캡션은 img title로 남는다(TOC·id 영향 없음).
// - 각주 정의 등 문법 밖 위치: 건드리지 않는다(sanitize가 요소를 걷는 기존 동작 유지).
// 캡션이 없는 이미지는 건드리지 않는다.

type CaptionedImage = Image & { title: string };
type Wrapper = Extract<
  PhrasingContent,
  { type: 'link' | 'linkReference' | 'emphasis' | 'strong' | 'delete' }
>;
type LinkLike = Link | LinkReference;
// 문단을 쪼갠 조각: 본문 글줄(run) 또는 figure로 올릴 이미지(링크로 감싼 상태의 media + 캡션)
type Segment = { figure: { media: PhrasingContent; caption: string } } | { run: PhrasingContent[] };

const isCaptioned = (node: PhrasingContent): node is CaptionedImage =>
  node.type === 'image' && Boolean(node.title);

const isBlank = (node: PhrasingContent) => node.type === 'text' && node.value.trim() === '';

const isWrapper = (node: PhrasingContent): node is Wrapper =>
  node.type === 'link' ||
  node.type === 'linkReference' ||
  node.type === 'emphasis' ||
  node.type === 'strong' ||
  node.type === 'delete';

const isLinkLike = (node: Wrapper): node is LinkLike =>
  node.type === 'link' || node.type === 'linkReference';

/** 캡션 이미지 하나를 figure 조각으로. 캡션이 화면에 보이므로 title 속성(툴팁·중복 낭독)은 지운다. */
function figureSegmentOf(image: CaptionedImage): Segment {
  return { figure: { media: { ...image, title: null }, caption: image.title } };
}

/** 감싸던 서식을 글줄 조각에 다시 입힌다. 공백뿐인 조각은 버린다. */
function rewrapRun(wrapper: Wrapper, run: PhrasingContent[]): Segment[] {
  if (run.every(isBlank)) return [];
  return [{ run: [{ ...wrapper, children: run } as PhrasingContent] }];
}

/** figure 조각의 이미지를 링크로 감싼다. 강조·취소선은 figure 밖 서식이라 입히지 않는다. */
function rewrapFigure(wrapper: Wrapper, segment: Extract<Segment, { figure: unknown }>): Segment {
  if (!isLinkLike(wrapper)) return segment;
  const media = { ...wrapper, children: [segment.figure.media] } as PhrasingContent;
  return { figure: { ...segment.figure, media } };
}

/** 감싸는 노드(링크·강조·취소선) 안을 재귀로 나눈 결과에 감싸던 노드를 다시 입힌다. */
function segmentsOfWrapper(wrapper: Wrapper): Segment[] {
  return segmentsOf(wrapper.children).flatMap((segment): Segment[] =>
    'figure' in segment ? [rewrapFigure(wrapper, segment)] : rewrapRun(wrapper, segment.run),
  );
}

/** 한 노드를 조각으로 바꾼다. figure로 뺄 이미지가 없으면 노드는 그대로 글줄에 남는다. */
function segmentsOfNode(node: PhrasingContent): Segment[] {
  if (isCaptioned(node)) return [figureSegmentOf(node)];
  if (isWrapper(node)) return segmentsOfWrapper(node);
  return [{ run: [node] }];
}

/** 인접한 글줄 조각을 합치며 phrasing 노드 목록을 조각으로 나눈다. */
function segmentsOf(children: PhrasingContent[]): Segment[] {
  const segments: Segment[] = [];
  for (const segment of children.flatMap(segmentsOfNode)) {
    const last = segments.at(-1);
    if ('run' in segment && last && 'run' in last) last.run.push(...segment.run);
    else segments.push(segment);
  }
  return segments;
}

/** `<figure>{media}<figcaption>캡션</figcaption></figure>`에 해당하는 mdast 블록. */
function figureBlock({ media, caption }: { media: PhrasingContent; caption: string }): Paragraph {
  return {
    type: 'paragraph',
    data: { hName: 'figure' },
    children: [
      media,
      {
        type: 'paragraph',
        data: { hName: 'figcaption' },
        children: [{ type: 'text', value: caption }],
      },
    ] as Paragraph['children'],
  };
}

/** 문단을 캡션 이미지 기준으로 쪼갠다. 본문 조각은 문단, 캡션 이미지는 figure가 된다. */
function splitParagraph(paragraph: Paragraph): Paragraph[] {
  return segmentsOf(paragraph.children).flatMap((segment): Paragraph[] => {
    if ('figure' in segment) return [figureBlock(segment.figure)];
    if (segment.run.every(isBlank)) return [];
    return [{ type: 'paragraph', children: segment.run }];
  });
}

const isFigure = (block: Paragraph) => block.data?.hName === 'figure';

/** 표 셀의 조각을 셀 자식으로 되돌린다. 글줄은 셀 안 phrasing 그대로, 캡션 이미지는 셀 안 figure가 된다. */
function cellChildrenOf(segments: Segment[]): TableCell['children'] {
  return segments.flatMap((segment): TableCell['children'] =>
    // figure 블록은 mdast상 셀의 phrasing 자리에 들어갈 수 없는 타입이지만, hast 변환은 hName으로 figure를 만든다.
    'figure' in segment ? [figureBlock(segment.figure) as unknown as PhrasingContent] : segment.run,
  );
}

/** 캡션 있는 이미지를 `<figure><img><figcaption>`로 바꾼다. 캡션이 없으면 이미지만 남긴다. */
export const remarkImageCaption: Plugin<[], Root> = () => (tree) => {
  visit(tree, 'paragraph', (paragraph, index, parent) => {
    if (!parent || index === undefined) return;
    const blocks = splitParagraph(paragraph);
    // figure로 바꿀 이미지가 없으면(블록이 문단 하나뿐이면) 원본을 그대로 둔다.
    if (!blocks.some(isFigure)) return;
    parent.children.splice(index, 1, ...blocks);
    // 새로 만든 figure 안의 figcaption 문단을 다시 방문하지 않도록 건너뛴다.
    return index + blocks.length;
  });
  visit(tree, 'tableCell', (cell) => {
    const segments = segmentsOf(cell.children);
    // 캡션 이미지가 없으면 원본 셀을 그대로 둔다.
    if (!segments.some((segment) => 'figure' in segment)) return;
    cell.children = cellChildrenOf(segments);
    return 'skip';
  });
};
