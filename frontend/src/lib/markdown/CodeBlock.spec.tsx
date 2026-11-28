import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CodeBlock } from './CodeBlock';

// 04 §2.2 ③·지시서 "코드 복사 버튼". 계약: 버튼 이름 "코드 복사" 유지, 상태는 data-copy-state="idle|copied|failed",
// 안내는 role="status" 영역의 텍스트("복사됨" / "복사하지 못했습니다")다. 성공 표시는 2초 뒤 idle로 돌아온다.

const CODE_LINES = ['const a = 1;', 'console.log(a);'];
const CODE = CODE_LINES.join('\n');

function stubClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

function renderBlock() {
  render(
    <CodeBlock>
      <code>
        <span className="line">{CODE_LINES[0]}</span>
        {'\n'}
        <span className="line">{CODE_LINES[1]}</span>
      </code>
    </CodeBlock>,
  );
  return screen.getByRole('button', { name: '코드 복사' });
}
const click = async (button: HTMLElement) => act(async () => void fireEvent.click(button));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('CodeBlock 복사 버튼', () => {
  it('누르면 렌더된 pre의 텍스트(줄바꿈 유지)를 클립보드에 쓴다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    await click(renderBlock());
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(CODE);
  });

  it('성공하면 "복사됨"을 role=status로 알리고 data-copy-state가 copied가 된다', async () => {
    stubClipboard(vi.fn().mockResolvedValue(undefined));
    const button = renderBlock();
    expect(button).toHaveAttribute('data-copy-state', 'idle');
    await click(button);
    expect(button).toHaveAttribute('data-copy-state', 'copied');
    expect(screen.getByText('복사됨').closest('[role="status"]')).not.toBeNull();
  });

  it('2초 뒤 아이콘이 원래대로 돌아오고 안내도 사라진다', async () => {
    stubClipboard(vi.fn().mockResolvedValue(undefined));
    const button = renderBlock();
    await click(button);
    act(() => vi.advanceTimersByTime(1500));
    expect(button).toHaveAttribute('data-copy-state', 'copied');
    act(() => vi.advanceTimersByTime(600));
    expect(button).toHaveAttribute('data-copy-state', 'idle');
    expect(screen.queryByText('복사됨')).toBeNull();
  });

  it('권한 거부면 "복사하지 못했습니다"를 보이고 failed 상태가 된다(예외를 삼키지 않는다)', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')));
    const button = renderBlock();
    await click(button);
    expect(button).toHaveAttribute('data-copy-state', 'failed');
    expect(screen.getByText('복사하지 못했습니다').closest('[role="status"]')).not.toBeNull();
    expect(screen.queryByText('복사됨')).toBeNull();
  });

  it('버튼 이름은 상태와 무관하게 "코드 복사"이고, 코드 영역은 .allow-select가 아니다', async () => {
    stubClipboard(vi.fn().mockResolvedValue(undefined));
    const button = renderBlock();
    await click(button);
    expect(screen.getByRole('button', { name: '코드 복사' })).toBe(button);
    expect(document.querySelector('.allow-select')).toBeNull();
  });
});
