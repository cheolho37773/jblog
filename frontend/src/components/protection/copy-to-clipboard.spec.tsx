import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyToClipboard, useCopyFeedback } from './copy-to-clipboard';

// 계약: copy-to-clipboard.ts가 copyToClipboard(text): Promise<boolean>(실패해도 던지지 않고 false)과
// useCopyFeedback(): { status: 'idle'|'copied'|'failed', copy(text): Promise<void> }를 export한다.
// 코드·링크·주소 복사 버튼이 모두 이것을 쓴다. 성공 표시는 2초 뒤 idle로 돌아온다.

const RESET_MS = 2000;

function stubClipboard(writeText: ReturnType<typeof vi.fn> | undefined) {
  Object.defineProperty(navigator, 'clipboard', {
    value: writeText ? { writeText } : undefined,
    configurable: true,
  });
}

afterEach(() => vi.useRealTimers());

describe('copyToClipboard', () => {
  it('성공하면 writeText에 받은 글을 그대로 넘기고 true를 돌려준다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    await expect(copyToClipboard('줄1\n줄2')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('줄1\n줄2');
  });

  it('권한 거부로 writeText가 reject되면 던지지 않고 false를 돌려준다', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')));
    await expect(copyToClipboard('x')).resolves.toBe(false);
  });

  it('비보안 문맥처럼 navigator.clipboard가 없으면 false다', async () => {
    stubClipboard(undefined);
    await expect(copyToClipboard('x')).resolves.toBe(false);
  });
});

describe('useCopyFeedback', () => {
  beforeEach(() => vi.useFakeTimers());

  it('처음에는 idle이다', () => {
    stubClipboard(vi.fn());
    const { result } = renderHook(() => useCopyFeedback());
    expect(result.current.status).toBe('idle');
  });

  it('성공하면 copied가 되고 2초 뒤 idle로 돌아온다', async () => {
    stubClipboard(vi.fn().mockResolvedValue(undefined));
    const { result } = renderHook(() => useCopyFeedback());
    await act(async () => result.current.copy('x'));
    expect(result.current.status).toBe('copied');

    act(() => vi.advanceTimersByTime(RESET_MS - 100));
    expect(result.current.status).toBe('copied');
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.status).toBe('idle');
  });

  it('권한 거부면 예외를 삼키지 않고 failed 상태로 드러낸다', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')));
    const { result } = renderHook(() => useCopyFeedback());
    await act(async () => result.current.copy('x'));
    expect(result.current.status).toBe('failed');
  });

  it('실패 뒤 다시 성공하면 copied가 된다', async () => {
    const writeText = vi
      .fn()
      .mockRejectedValueOnce(new Error('denied'))
      .mockResolvedValue(undefined);
    stubClipboard(writeText);
    const { result } = renderHook(() => useCopyFeedback());
    await act(async () => result.current.copy('x'));
    await act(async () => result.current.copy('x'));
    expect(result.current.status).toBe('copied');
  });
});
