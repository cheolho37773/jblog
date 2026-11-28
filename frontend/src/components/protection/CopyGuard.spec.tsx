import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopyGuard } from './CopyGuard';

// 04 §2.2 ② 이벤트별 차단/허용, 등록·해제, 토스트(3초에 1번). CopyGuard는 아무것도 그리지 않거나 토스트만 그린다.
// 계약: components/protection/CopyGuard.tsx가 named export CopyGuard를 낸다. 토스트는 role="status"(aria-live="polite")다.

const TOAST = '콘텐츠 복사가 제한되어 있습니다';
const TOAST_MS = 3000;
const GUARDED_EVENTS = ['copy', 'cut', 'contextmenu', 'dragstart', 'selectstart', 'keydown'];

function mountContent() {
  const root = document.createElement('div');
  root.innerHTML = `
    <p id="body">본문 문단</p>
    <p id="contact" class="allow-select">hello@example.com</p>
    <input id="search" value="검색어" />
    <img id="img" alt="" src="/x.png" />
    <a id="link" href="/blog">링크</a>`;
  document.body.append(root);
  return (id: string) => root.querySelector<HTMLElement>(`#${id}`)!;
}

function fire(target: Element, type: string, init: EventInit & KeyboardEventInit = {}) {
  const event =
    type === 'keydown'
      ? new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init })
      : new Event(type, { bubbles: true, cancelable: true });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

const select = (el: Element, from = 0, to = 2) => {
  const node = el.firstChild as Text;
  window.getSelection()?.setBaseAndExtent(node, from, node, to);
};
const toasts = () => screen.queryAllByText(TOAST);

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('CopyGuard: 이벤트별 차단·허용', () => {
  let $: ReturnType<typeof mountContent>;
  beforeEach(() => {
    $ = mountContent();
    render(<CopyGuard />);
  });

  it('본문 선택의 copy·cut은 막고 안내 토스트를 띄운다', () => {
    select($('body'));
    expect(fire($('body'), 'copy').defaultPrevented).toBe(true);
    expect(toasts()).toHaveLength(1);
    expect(fire($('body'), 'cut').defaultPrevented).toBe(true);
  });

  it('.allow-select 안 선택의 copy·cut은 허용하고 토스트도 없다', () => {
    select($('contact'), 0, 5);
    expect(fire($('contact'), 'copy').defaultPrevented).toBe(false);
    expect(fire($('contact'), 'cut').defaultPrevented).toBe(false);
    expect(toasts()).toHaveLength(0);
  });

  it('입력 요소의 copy·cut은 허용한다', () => {
    $('search').focus();
    expect(fire($('search'), 'copy').defaultPrevented).toBe(false);
    expect(fire($('search'), 'cut').defaultPrevented).toBe(false);
    expect(toasts()).toHaveLength(0);
  });

  it('contextmenu: 본문·이미지는 막고, 입력 요소·.allow-select는 허용한다', () => {
    expect(fire($('body'), 'contextmenu').defaultPrevented).toBe(true);
    expect(fire($('img'), 'contextmenu').defaultPrevented).toBe(true);
    expect(fire($('search'), 'contextmenu').defaultPrevented).toBe(false);
    expect(fire($('contact'), 'contextmenu').defaultPrevented).toBe(false);
  });

  it('selectstart: 본문은 막고, 입력 요소·.allow-select는 허용한다', () => {
    expect(fire($('body'), 'selectstart').defaultPrevented).toBe(true);
    expect(fire($('search'), 'selectstart').defaultPrevented).toBe(false);
    expect(fire($('contact'), 'selectstart').defaultPrevented).toBe(false);
  });

  it('dragstart: 이미지·링크·본문 텍스트 드래그를 막는다', () => {
    for (const id of ['img', 'link', 'body']) {
      expect(fire($(id), 'dragstart').defaultPrevented, id).toBe(true);
    }
  });

  for (const [label, modifier] of [
    ['Cmd', { metaKey: true }],
    ['Ctrl', { ctrlKey: true }],
  ] as const) {
    it(`${label}+S는 막고, ${label}+P는 막고 같은 토스트를 띄운다`, () => {
      expect(fire($('body'), 'keydown', { key: 's', ...modifier }).defaultPrevented).toBe(true);
      expect(fire($('body'), 'keydown', { key: 'p', ...modifier }).defaultPrevented).toBe(true);
      expect(toasts()).toHaveLength(1);
    });

    it(`${label}+C는 본문에서 막고 토스트를 띄우며, 입력 요소에서는 허용한다`, () => {
      expect(fire($('body'), 'keydown', { key: 'c', ...modifier }).defaultPrevented).toBe(true);
      expect(toasts()).toHaveLength(1);
    });

    it(`${label}+A는 입력 요소 밖에서 막고 안에서는 허용하며, ${label}+F는 막지 않는다`, () => {
      expect(fire($('body'), 'keydown', { key: 'a', ...modifier }).defaultPrevented).toBe(true);
      expect(fire($('search'), 'keydown', { key: 'a', ...modifier }).defaultPrevented).toBe(false);
      expect(fire($('body'), 'keydown', { key: 'f', ...modifier }).defaultPrevented).toBe(false);
    });
  }

  it('입력 요소 안 Cmd+C·X는 허용한다', () => {
    $('search').focus();
    expect(fire($('search'), 'keydown', { key: 'c', metaKey: true }).defaultPrevented).toBe(false);
    expect(fire($('search'), 'keydown', { key: 'x', ctrlKey: true }).defaultPrevented).toBe(false);
  });
});

describe('CopyGuard: 등록과 해제', () => {
  it('document에 이벤트별로 한 번만 등록한다', () => {
    const add = vi.spyOn(document, 'addEventListener');
    render(<CopyGuard />);
    for (const type of GUARDED_EVENTS) {
      const calls = add.mock.calls.filter(([name]) => name === type);
      expect(calls, type).toHaveLength(1);
    }
  });

  it('언마운트하면 등록한 같은 함수를 해제하고, 이후 이벤트는 막지 않는다', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    const $ = mountContent();
    const { unmount } = render(<CopyGuard />);
    unmount();
    for (const type of GUARDED_EVENTS) {
      const added = add.mock.calls.find(([name]) => name === type)?.[1];
      expect(
        remove.mock.calls.some(([name, fn]) => name === type && fn === added),
        type,
      ).toBe(true);
    }
    select($('body'));
    expect(fire($('body'), 'copy').defaultPrevented).toBe(false);
  });
});

describe('CopyGuard: 안내 토스트', () => {
  beforeEach(() => vi.useFakeTimers());

  it('role="status"·aria-live="polite" 영역에 문구를 보여 주고 3초 뒤 사라진다', () => {
    const $ = mountContent();
    render(<CopyGuard />);
    select($('body'));
    fire($('body'), 'copy');
    const region = screen.getByText(TOAST).closest('[role="status"]');
    expect(region).not.toBeNull();
    expect(region).toHaveAttribute('aria-live', 'polite');

    act(() => vi.advanceTimersByTime(TOAST_MS - 500));
    expect(toasts()).toHaveLength(1);
    act(() => vi.advanceTimersByTime(700));
    expect(toasts()).toHaveLength(0);
  });

  it('3초 안에 또 막아도 토스트는 1개이고, 지난 뒤 다시 막으면 다시 나온다', () => {
    const $ = mountContent();
    render(<CopyGuard />);
    select($('body'));
    fire($('body'), 'copy');
    act(() => vi.advanceTimersByTime(1000));
    fire($('body'), 'copy');
    fire($('body'), 'keydown', { key: 'p', ctrlKey: true });
    expect(toasts()).toHaveLength(1);

    act(() => vi.advanceTimersByTime(TOAST_MS + 200));
    expect(toasts()).toHaveLength(0);
    fire($('body'), 'copy');
    expect(toasts()).toHaveLength(1);
  });
});
