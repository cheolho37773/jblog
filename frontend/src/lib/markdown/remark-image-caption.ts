import type { Image, Paragraph, Root } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

// `![alt](url "캡션")`: 제목 속성이 있으면 캡션이다 (지시서 "문법 확정").
// 문단에 이미지 하나만 있을 때만 figure로 바꾼다. 글 사이에 낀 이미지의 title은 캡션이 되지 않고, sanitize가 title 속성을 지운다.

function loneImage(paragraph: Paragraph): Image | undefined {
  const meaningful = paragraph.children.filter(
    (child) => !(child.type === 'text' && child.value.trim() === ''),
  );
  const [only] = meaningful;
  return meaningful.length === 1 && only?.type === 'image' ? only : undefined;
}

/** 캡션 있는 이미지 문단을 `<figure><img><figcaption>`로 바꾼다. 캡션이 없으면 이미지만 남긴다. */
export const remarkImageCaption: Plugin<[], Root> = () => (tree) => {
  visit(tree, 'paragraph', (paragraph) => {
    const image = loneImage(paragraph);
    const caption = image?.title;
    if (!image || !caption) return;

    // 캡션이 이미 화면에 보이므로 title 속성(툴팁·스크린리더 중복 낭독)은 남기지 않는다.
    const imageWithoutTitle: Image = { ...image, title: null };
    paragraph.data = { hName: 'figure' };
    paragraph.children = [
      imageWithoutTitle,
      {
        type: 'paragraph',
        data: { hName: 'figcaption' },
        children: [{ type: 'text', value: caption }],
      },
    ] as Paragraph['children'];
  });
};
