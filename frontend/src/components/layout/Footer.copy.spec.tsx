import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Footer } from './Footer';

// M2-10 주소 복사: Contact Me 카드의 이메일 옆 "주소 복사" 버튼. 이메일 값이 없으면 버튼도 없다.
// 성공 안내는 `주소를 복사했습니다`, 실패 안내는 `복사하지 못했습니다`(오케스트레이터 판정).

const EMAIL = 'hello@example.com';
const GITHUB_URL = 'https://github.com/example';
const stub = (writeText: ReturnType<typeof vi.fn>) =>
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
const copyButton = () =>
  within(screen.getByRole('contentinfo')).queryByRole('button', { name: '주소 복사' });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Footer 주소 복사', () => {
  it('이메일이 있으면 주소 복사 버튼이 있고, 눌러도 이메일 주소만 복사한다(mailto:·GitHub 제외)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stub(writeText);
    render(<Footer contact={{ email: EMAIL, githubUrl: GITHUB_URL }} />);
    const button = copyButton();
    expect(button).not.toBeNull();
    await act(async () => void fireEvent.click(button!));
    expect(writeText).toHaveBeenCalledWith(EMAIL);
    expect(button).toHaveAttribute('data-copy-state', 'copied');
    expect(screen.getByText('주소를 복사했습니다').closest('[role="status"]')).not.toBeNull();
  });

  it('권한 거부면 "복사하지 못했습니다"를 보인다', async () => {
    stub(vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')));
    render(<Footer contact={{ email: EMAIL }} />);
    await act(async () => void fireEvent.click(copyButton()!));
    expect(screen.getByText('복사하지 못했습니다')).toBeInTheDocument();
  });

  it('이메일이 없으면(GitHub만 있어도) 주소 복사 버튼이 없다', () => {
    render(<Footer contact={{ githubUrl: GITHUB_URL }} />);
    expect(copyButton()).toBeNull();
  });

  it('연락처가 아예 없으면 카드도 버튼도 없다', () => {
    render(<Footer />);
    expect(copyButton()).toBeNull();
  });

  it('이메일 텍스트는 여전히 .allow-select 안에 있다', () => {
    render(<Footer contact={{ email: EMAIL }} />);
    expect(screen.getByText(EMAIL).closest('.allow-select')).not.toBeNull();
  });
});
