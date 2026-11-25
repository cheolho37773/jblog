import type { Image, Paragraph, PhrasingContent, Root } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

// `![alt](url "캡션")`: 제목 속성이 있으면 캡션이다 (지시서 "문법 확정").
// 캡션 이미지는 문장 속에 있어도 별도 figure 블록으로 분리하고, 앞뒤 본문은 각자 문단으로 보존한다.
// 캡션이 없는 이미지는 건드리지 않는다.

const isCaptioned = (node: PhrasingContent): node is Image & { title: string } =>
  node.type === 'image' && Boolean(node.title);

const isBlank = (node: PhrasingContent) => node.type === 'text' && node.value.trim() === '';

function figureOf(image: Image & { title: string }): Paragraph {
  // 캡션이 이미 화면에 보이므로 title 속성(툴팁·스크린리더 중복 낭독)은 남기지 않는다.
  const imageWithoutTitle: Image = { ...image, title: null };
  return {
    type: 'paragraph',
    data: { hName: 'figure' },
    children: [
      imageWithoutTitle,
      {
        type: 'paragraph',
        data: { hName: 'figcaption' },
        children: [{ type: 'text', value: image.title }],
      },
    ] as Paragraph['children'],
  };
}

/** 문단을 캡션 이미지 기준으로 쪼갠다. 본문 조각은 문단, 캡션 이미지는 figure가 된다. */
function splitParagraph(paragraph: Paragraph): Paragraph[] {
  const blocks: Paragraph[] = [];
  let run: PhrasingContent[] = [];
  const flush = () => {
    if (run.every(isBlank)) return void (run = []);
    blocks.push({ type: 'paragraph', children: run });
    run = [];
  };

  for (const child of paragraph.children) {
    if (isCaptioned(child)) {
      flush();
      blocks.push(figureOf(child));
    } else {
      run.push(child);
    }
  }
  flush();
  return blocks;
}

/** 캡션 있는 이미지를 `<figure><img><figcaption>`로 바꾼다. 캡션이 없으면 이미지만 남긴다. */
export const remarkImageCaption: Plugin<[], Root> = () => (tree) => {
  visit(tree, 'paragraph', (paragraph, index, parent) => {
    if (!parent || index === undefined) return;
    if (!paragraph.children.some(isCaptioned)) return;

    const blocks = splitParagraph(paragraph);
    parent.children.splice(index, 1, ...blocks);
    // 새로 만든 figure 안의 figcaption 문단을 다시 방문하지 않도록 건너뛴다.
    return index + blocks.length;
  });
};
