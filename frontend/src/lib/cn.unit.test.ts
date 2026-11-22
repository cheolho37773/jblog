import { describe, expect, it } from 'vitest';
import { cn } from './cn';

// 타이포 유틸(font-size)과 색 유틸이 같은 text-* 접두어라 서로 지우지 않아야 한다.
describe('cn: 타이포 유틸과 색 유틸 구분', () => {
  it.each([
    'text-on-primary',
    'text-primary-text',
    'text-danger',
    'text-toggle-knob-icon',
    'text-strong',
  ])('%s는 text-b4와 함께 남는다', (colorClass) => {
    expect(cn('text-b4', colorClass)).toBe(`text-b4 ${colorClass}`);
    expect(cn(colorClass, 'text-b4')).toBe(`${colorClass} text-b4`);
  });

  it('같은 그룹끼리는 뒤의 것만 남는다', () => {
    expect(cn('text-b4', 'text-b5')).toBe('text-b5');
    expect(cn('text-strong', 'text-danger')).toBe('text-danger');
  });
});
