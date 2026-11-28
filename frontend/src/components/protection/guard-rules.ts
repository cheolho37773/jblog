// 04 §2.2 "예외 판정 규칙". DOM만 있으면 검사할 수 있는 순수 함수라 CopyGuard와 따로 테스트한다.

const EDITABLE_SELECTOR = 'input, textarea, [contenteditable="true"]';
const ALLOW_SELECT_SELECTOR = '.allow-select';

/** 텍스트 노드는 closest가 없어 부모 요소로 올려서 본다. */
function toElement(node: EventTarget | Node | null): Element | null {
  if (node instanceof Element) return node;
  if (node instanceof Node) return node.parentElement;
  return null;
}

/**
 * 입력 요소 문맥인가. 이벤트 대상이나 포커스 요소가 입력 요소면 먼저 허용한다.
 * input 안의 선택은 window.getSelection()에 잡히지 않아 선택 범위 검사를 적용하면 검색창 복사가 막히기 때문이다.
 */
export function isEditableContext(event: Event): boolean {
  const inEditable = (node: EventTarget | null) =>
    Boolean(toElement(node)?.closest(EDITABLE_SELECTOR));
  return inEditable(event.target) || inEditable(document.activeElement);
}

/** 이벤트 대상이 `.allow-select`(연락처) 안인가. selectstart·contextmenu 판정에 쓴다. */
export function isInAllowSelect(event: Event): boolean {
  return Boolean(toElement(event.target)?.closest(ALLOW_SELECT_SELECTOR));
}

/** 선택의 시작과 끝이 모두 `.allow-select` 안일 때만 허용한다. 연락처에서 본문까지 걸친 선택은 차단된다. */
export function isAllowedTextSelection(
  selection: Selection | null = window.getSelection(),
): boolean {
  if (!selection || selection.isCollapsed) return false;
  const inAllowed = (node: Node | null) => Boolean(toElement(node)?.closest(ALLOW_SELECT_SELECTOR));
  return inAllowed(selection.anchorNode) && inAllowed(selection.focusNode);
}

/** copy·cut 이벤트나 C/X 단축키를 허용해야 하는가. */
export function isCopyAllowed(event: Event): boolean {
  return isEditableContext(event) || isAllowedTextSelection();
}

/** Cmd(Mac)·Ctrl(그 외) 단축키를 막아야 하는가. F(찾기) 등 목록 밖 키는 막지 않는다. */
export function shouldBlockShortcut(event: KeyboardEvent): boolean {
  if (!event.metaKey && !event.ctrlKey) return false;
  switch (event.key.toLowerCase()) {
    case 's':
    case 'p':
      return true;
    case 'c':
    case 'x':
      return !isCopyAllowed(event);
    case 'a':
      return !isEditableContext(event);
    default:
      return false;
  }
}
