import type { Element, ElementContent, Root } from 'hast';
import { toString } from 'hast-util-to-string';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

// gfm 체크리스트(`- [x] 할 일`)는 라벨 없는 체크박스를 만든다. 라벨이 없으면 스크린리더가 무엇인지 알 수 없고
// axe의 label 규칙(critical)에도 걸린다. 항목 글자를 체크박스의 aria-label로 붙인다.

const elementsOf = (parent: Element, tagName: string): Element[] =>
  parent.children.filter(
    (child): child is Element => child.type === 'element' && child.tagName === tagName,
  );

function findCheckbox(item: Element): Element | undefined {
  // 느슨한 목록은 체크박스가 문단 안에 있다.
  const containers = [item, ...elementsOf(item, 'p')];
  return containers.flatMap((container) => elementsOf(container, 'input'))[0];
}

const isNestedList = (node: ElementContent) =>
  node.type === 'element' && (node.tagName === 'ul' || node.tagName === 'ol');

// 하위 목록의 글자는 이 항목의 이름이 아니다.
const labelOf = (item: Element) =>
  item.children
    .filter((child) => !isNestedList(child))
    .map((child) => (child.type === 'comment' ? '' : toString(child)))
    .join('')
    .trim();

export const rehypeTaskLabels: Plugin<[], Root> = () => (tree) => {
  visit(tree, 'element', (item) => {
    if (item.tagName !== 'li') return;
    const checkbox = findCheckbox(item);
    if (!checkbox) return;
    checkbox.properties.ariaLabel = labelOf(item);
  });
};
