import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('거짓 값은 버리고 클래스를 합친다', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b');
  });

  it('충돌하는 Tailwind 유틸은 뒤에 온 것만 남긴다', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('조건 객체를 받는다', () => {
    expect(cn('a', { b: true, c: false })).toBe('a b');
  });
});
