import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopyLinkButton } from './CopyLinkButton';

// 계약: features/posts/components/CopyLinkButton.tsx가 named export CopyLinkButton({ url })를 낸다.
// 버튼 이름 "링크 복사", url(canonical 절대 주소)만 복사, data-copy-state, role=status 안내.

const URL_TEXT = 'https://blog.example.com/blog/tailwind-design-tokens';
const stub = (writeText: ReturnType<typeof vi.fn>) =>
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
const click = async (button: HTMLElement) => act(async () => void fireEvent.click(button));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('CopyLinkButton', () => {
  it('누르면 받은 canonical 주소만 복사하고 "링크를 복사했습니다"를 알린다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stub(writeText);
    render(<CopyLinkButton url={URL_TEXT} />);
    const button = screen.getByRole('button', { name: '링크 복사' });
    await click(button);
    expect(writeText).toHaveBeenCalledWith(URL_TEXT);
    expect(button).toHaveAttribute('data-copy-state', 'copied');
    expect(screen.getByText('링크를 복사했습니다').closest('[role="status"]')).not.toBeNull();
  });

  it('2초 뒤 idle로 돌아온다', async () => {
    stub(vi.fn().mockResolvedValue(undefined));
    render(<CopyLinkButton url={URL_TEXT} />);
    const button = screen.getByRole('button', { name: '링크 복사' });
    await click(button);
    act(() => vi.advanceTimersByTime(2100));
    expect(button).toHaveAttribute('data-copy-state', 'idle');
    expect(screen.queryByText('링크를 복사했습니다')).toBeNull();
  });

  it('권한 거부면 "복사하지 못했습니다"를 보인다', async () => {
    stub(vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')));
    render(<CopyLinkButton url={URL_TEXT} />);
    const button = screen.getByRole('button', { name: '링크 복사' });
    await click(button);
    expect(button).toHaveAttribute('data-copy-state', 'failed');
    expect(screen.getByText('복사하지 못했습니다').closest('[role="status"]')).not.toBeNull();
  });
});
