import type { Image, Link, Paragraph, PhrasingContent, Root } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

// `![alt](url "캡션")`: 제목 속성이 있으면 캡션이다 (지시서 "문법 확정").
// 캡션 이미지는 문장 속에 있어도 별도 figure 블록으로 분리하고, 앞뒤 본문은 각자 문단으로 보존한다.
// 캡션이 없는 이미지는 건드리지 않는다.

type CaptionedImage = Image & { title: string };
type Emphasis = Extract<PhrasingContent, { type: 'emphasis' | 'strong' | 'delete' }>;
// 문단을 쪼갠 조각: 본문 글줄(run) 또는 figure 블록
type Segment = { figure: Paragraph } | { run: PhrasingContent[] };

const isCaptioned = (node: PhrasingContent): node is CaptionedImage =>
  node.type === 'image' && Boolean(node.title);

const isBlank = (node: PhrasingContent) => node.type === 'text' && node.value.trim() === '';

const isEmphasis = (node: PhrasingContent): node is Emphasis =>
  node.type === 'emphasis' || node.type === 'strong' || node.type === 'delete';

/** 링크가 캡션 이미지 하나만 감싸고 있으면(공백 제외) 그 이미지를 돌려준다. 글자가 섞이면 undefined. */
function soleCaptionedImage(link: Link): CaptionedImage | undefined {
  const content = link.children.filter((child) => !isBlank(child));
  const [only] = content;
  return content.length === 1 && only && isCaptioned(only) ? only : undefined;
}

/** figure 블록. 링크로 감싼 이미지는 `figure > a > img`로 목적지를 유지한다. */
function figureOf(image: CaptionedImage, link?: Link): Paragraph {
  // 캡션이 이미 화면에 보이므로 title 속성(툴팁·스크린리더 중복 낭독)은 남기지 않는다.
  const imageWithoutTitle: Image = { ...image, title: null };
  const media = link ? { ...link, children: [imageWithoutTitle] } : imageWithoutTitle;
  return {
    type: 'paragraph',
    data: { hName: 'figure' },
    children: [
      media,
      {
        type: 'paragraph',
        data: { hName: 'figcaption' },
        children: [{ type: 'text', value: image.title }],
      },
    ] as Paragraph['children'],
  };
}

/** 강조 안에서 나온 조각에 강조를 다시 입힌다. 글자는 서식을 유지하고 figure는 그대로 둔다. */
function rewrapEmphasis(emphasis: Emphasis, inner: Segment[]): Segment[] {
  return inner.flatMap((segment): Segment[] => {
    if ('figure' in segment) return [segment];
    if (segment.run.every(isBlank)) return [];
    return [{ run: [{ ...emphasis, children: segment.run } as PhrasingContent] }];
  });
}

/** 한 노드를 조각으로 바꾼다. figure로 뺄 이미지가 없으면 노드는 그대로 글줄에 남는다. */
function segmentsOfNode(node: PhrasingContent): Segment[] {
  if (isCaptioned(node)) return [{ figure: figureOf(node) }];
  if (node.type === 'link') {
    const image = soleCaptionedImage(node);
    // 글자와 섞인 링크는 나누지 않는다. 이미지 title은 그대로 남아 캡션 정보가 보존된다.
    return image ? [{ figure: figureOf(image, node) }] : [{ run: [node] }];
  }
  if (isEmphasis(node)) return rewrapEmphasis(node, segmentsOf(node.children));
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

/** 문단을 캡션 이미지 기준으로 쪼갠다. 본문 조각은 문단, 캡션 이미지는 figure가 된다. */
function splitParagraph(paragraph: Paragraph): Paragraph[] {
  return segmentsOf(paragraph.children).flatMap((segment): Paragraph[] => {
    if ('figure' in segment) return [segment.figure];
    if (segment.run.every(isBlank)) return [];
    return [{ type: 'paragraph', children: segment.run }];
  });
}

const isFigure = (block: Paragraph) => block.data?.hName === 'figure';

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
};
