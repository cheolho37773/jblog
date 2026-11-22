import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Input } from './Input';

describe('Input', () => {
  it('label이 입력 요소에 연결된다', () => {
    render(<Input label="이메일" />);

    expect(screen.getByLabelText('이메일')).toBeInstanceOf(HTMLInputElement);
    expect(screen.getByRole('textbox', { name: '이메일' })).toBeInTheDocument();
  });

  it('입력한 값을 onChange로 전달한다', async () => {
    const onChange = vi.fn();
    render(<Input label="이메일" onChange={onChange} />);

    await userEvent.type(screen.getByLabelText('이메일'), 'a');

    expect(onChange).toHaveBeenCalled();
  });

  it('오류가 없으면 aria-invalid가 아니다', () => {
    render(<Input label="이메일" />);

    expect(screen.getByLabelText('이메일')).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('error가 있으면 aria-invalid이고 오류 문구가 설명으로 연결된다', () => {
    render(<Input label="이메일" error="올바른 이메일을 입력하세요" />);

    const input = screen.getByLabelText('이메일');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('올바른 이메일을 입력하세요');
    expect(screen.getByText('올바른 이메일을 입력하세요')).toBeVisible();
  });

  it('error 상태는 정상 상태와 다른 클래스를 가진다', () => {
    const { rerender } = render(<Input label="이메일" />);
    const normal = screen.getByLabelText('이메일').className;

    rerender(<Input label="이메일" error="오류" />);

    expect(screen.getByLabelText('이메일').className).not.toBe(normal);
  });

  it('disabled이면 입력할 수 없다', () => {
    render(<Input label="이메일" disabled />);

    expect(screen.getByLabelText('이메일')).toBeDisabled();
  });

  it('같은 화면의 Input 두 개는 서로 다른 label에 연결된다', () => {
    render(
      <>
        <Input label="이름" />
        <Input label="이메일" />
      </>,
    );

    expect(screen.getByLabelText('이름')).not.toBe(screen.getByLabelText('이메일'));
  });
});
