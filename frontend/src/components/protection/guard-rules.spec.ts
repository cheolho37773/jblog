import { afterEach, describe, expect, it } from 'vitest';
import { isAllowedTextSelection, isEditableContext, shouldBlockShortcut } from './guard-rules';

// 04 §2.2 "예외 판정 규칙" 표의 모든 칸. 판정 함수는 순수 함수라 DOM만 있으면 검사할 수 있다.
// 계약: guard-rules.ts가 isEditableContext(event), isAllowedTextSelection(selection?), shouldBlockShortcut(keydownEvent)를 export한다.

function mount(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.append(root);
  return root;
}

const q = <T extends Element>(root: Element, selector: string) => {
  const found = root.querySelector<T>(selector);
  if (!found) throw new Error(`없는 요소: ${selector}`);
  return found;
};

/** 대상 요소에서 이벤트를 실제로 보내고, 리스너 안에서 판정 함수를 돌린다(target이 채워진 상태). */
function judge<T>(target: Element, event: Event, fn: (event: Event) => T): T {
  let result: T | undefined;
  document.addEventListener(event.type, (e) => (result = fn(e)), { once: true });
  target.dispatchEvent(event);
  return result as T;
}

const keydown = (key: string, init: KeyboardEventInit = {}) =>
  new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });

type Point = [node: Node, offset: number];
function selectBetween([from, fromOffset]: Point, [to, toOffset]: Point) {
  window.getSelection()?.setBaseAndExtent(from, fromOffset, to, toOffset);
}
const text = (el: Element) => el.firstChild as Text;

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  (document.activeElement as HTMLElement | null)?.blur();
  document.body.innerHTML = '';
});

describe('isEditableContext', () => {
  it('input·textarea·contenteditable=true에서 난 이벤트는 입력 요소 문맥이다', () => {
    const root = mount(
      '<input id="i"><textarea id="t"></textarea><div contenteditable="true"><span id="c">x</span></div>',
    );
    for (const selector of ['#i', '#t', '#c']) {
      const target = q(root, selector);
      expect(judge(target, new Event('copy', { bubbles: true }), isEditableContext), selector).toBe(
        true,
      );
    }
  });

  it('일반 문단에서 난 이벤트는 입력 요소 문맥이 아니다', () => {
    const root = mount('<p id="p">본문</p>');
    expect(judge(q(root, '#p'), new Event('copy', { bubbles: true }), isEditableContext)).toBe(
      false,
    );
  });

  it('contenteditable="false"는 입력 요소가 아니다', () => {
    const root = mount('<div contenteditable="false"><span id="s">x</span></div>');
    expect(judge(q(root, '#s'), new Event('copy', { bubbles: true }), isEditableContext)).toBe(
      false,
    );
  });

  it('대상은 일반 문단이어도 포커스가 입력 요소에 있으면 입력 요소 문맥이다', () => {
    const root = mount('<input id="i"><p id="p">본문</p>');
    q<HTMLInputElement>(root, '#i').focus();
    expect(judge(q(root, '#p'), new Event('copy', { bubbles: true }), isEditableContext)).toBe(
      true,
    );
  });
});

describe('isAllowedTextSelection', () => {
  it('선택이 없으면 허용하지 않는다', () => {
    mount('<p class="allow-select">a</p>');
    expect(isAllowedTextSelection()).toBe(false);
    expect(isAllowedTextSelection(null)).toBe(false);
  });

  it('접힌 선택(캐럿만 있음)은 허용하지 않는다', () => {
    const root = mount('<p class="allow-select">연락처</p>');
    const node = text(q(root, 'p'));
    selectBetween([node, 1], [node, 1]);
    expect(isAllowedTextSelection()).toBe(false);
  });

  it('시작과 끝이 모두 .allow-select 안이면 허용한다', () => {
    const root = mount('<div class="allow-select"><p>메일</p><p>깃허브</p></div>');
    const [a, b] = root.querySelectorAll('p');
    selectBetween([text(a!), 0], [text(b!), 2]);
    expect(isAllowedTextSelection()).toBe(true);
    expect(isAllowedTextSelection(window.getSelection())).toBe(true);
  });

  it('시작만 .allow-select 안이면 허용하지 않는다(연락처에서 본문으로 걸친 선택)', () => {
    const root = mount('<p class="allow-select">연락처</p><p id="body">본문</p>');
    selectBetween([text(q(root, '.allow-select')), 0], [text(q(root, '#body')), 2]);
    expect(isAllowedTextSelection()).toBe(false);
  });

  it('끝만 .allow-select 안이어도 허용하지 않는다(본문에서 연락처로)', () => {
    const root = mount('<p id="body">본문</p><p class="allow-select">연락처</p>');
    selectBetween([text(q(root, '#body')), 0], [text(q(root, '.allow-select')), 2]);
    expect(isAllowedTextSelection()).toBe(false);
  });

  it('둘 다 바깥이면 허용하지 않는다', () => {
    const root = mount('<p id="body">본문 텍스트</p>');
    selectBetween([text(q(root, '#body')), 0], [text(q(root, '#body')), 3]);
    expect(isAllowedTextSelection()).toBe(false);
  });
});

// 단축키 표: S·P 항상 차단 / C·X 입력 요소 문맥이거나 .allow-select 선택이면 허용 / A 입력 요소 문맥에서만 허용 / F 허용
describe('shouldBlockShortcut', () => {
  const MODIFIERS = [
    ['Cmd(metaKey, Mac)', { metaKey: true }],
    ['Ctrl(ctrlKey, 그 외)', { ctrlKey: true }],
  ] as const;

  function verdict(target: Element, key: string, init: KeyboardEventInit) {
    return judge(target, keydown(key, init), (e) => shouldBlockShortcut(e as KeyboardEvent));
  }

  for (const [label, modifier] of MODIFIERS) {
    describe(label, () => {
      it('S·P는 어디서든 차단한다(입력 요소 안에서도, 대문자도)', () => {
        const root = mount('<p id="p">본문</p><input id="i">');
        for (const key of ['s', 'p', 'S', 'P']) {
          expect(verdict(q(root, '#p'), key, modifier), `본문 ${key}`).toBe(true);
          expect(verdict(q(root, '#i'), key, modifier), `입력 ${key}`).toBe(true);
        }
      });

      it('C·X는 선택이 없는 본문에서 차단한다', () => {
        const root = mount('<p id="p">본문</p>');
        expect(verdict(q(root, '#p'), 'c', modifier)).toBe(true);
        expect(verdict(q(root, '#p'), 'x', modifier)).toBe(true);
      });

      it('C·X는 입력 요소 문맥이면 허용한다', () => {
        const root = mount('<input id="i"><textarea id="t"></textarea>');
        for (const id of ['#i', '#t']) {
          expect(verdict(q(root, id), 'c', modifier)).toBe(false);
          expect(verdict(q(root, id), 'x', modifier)).toBe(false);
        }
      });

      it('C·X는 .allow-select 안의 선택이면 허용하고, 본문에 걸치면 차단한다', () => {
        const root = mount('<p class="allow-select">연락처</p><p id="body">본문</p>');
        const contact = text(q(root, '.allow-select'));
        selectBetween([contact, 0], [contact, 3]);
        expect(verdict(q(root, '.allow-select'), 'c', modifier)).toBe(false);
        expect(verdict(q(root, '.allow-select'), 'x', modifier)).toBe(false);

        selectBetween([contact, 0], [text(q(root, '#body')), 2]);
        expect(verdict(q(root, '#body'), 'c', modifier)).toBe(true);
      });

      it('A는 입력 요소 문맥에서만 허용하고, 본문·.allow-select에서는 차단한다', () => {
        const root = mount('<input id="i"><p id="p">본문</p><p class="allow-select">연락처</p>');
        expect(verdict(q(root, '#i'), 'a', modifier)).toBe(false);
        expect(verdict(q(root, '#p'), 'a', modifier)).toBe(true);
        expect(verdict(q(root, '.allow-select'), 'a', modifier)).toBe(true);
      });

      it('F(찾기)는 어디서든 막지 않는다', () => {
        const root = mount('<p id="p">본문</p>');
        expect(verdict(q(root, '#p'), 'f', modifier)).toBe(false);
        expect(verdict(q(root, '#p'), 'F', modifier)).toBe(false);
      });
    });
  }

  it('수정키 없이 누른 s·p·c·a는 막지 않는다', () => {
    const root = mount('<p id="p">본문</p>');
    for (const key of ['s', 'p', 'c', 'x', 'a']) {
      expect(verdict(q(root, '#p'), key, {}), key).toBe(false);
    }
  });

  it('목록에 없는 키(v·z)는 막지 않는다', () => {
    const root = mount('<p id="p">본문</p>');
    expect(verdict(q(root, '#p'), 'v', { ctrlKey: true })).toBe(false);
    expect(verdict(q(root, '#p'), 'z', { metaKey: true })).toBe(false);
  });
});
