import { describe, expect, it } from 'vitest';
import { parseDevAllowedOrigins } from './dev-allowed-origins';

const VARIABLE_NAME = 'JBLOG_DEV_ALLOWED_ORIGINS';

function errorMessageOf(raw: string): string {
  try {
    parseDevAllowedOrigins(raw);
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error('parseDevAllowedOrigins가 오류를 던지지 않았다');
}

describe('parseDevAllowedOrigins', () => {
  it.each([
    ['값이 없으면', undefined],
    ['빈 문자열이면', ''],
    ['공백만 있으면', '   '],
    ['쉼표와 공백만 있으면', ' , ,, '],
  ])('%s 빈 목록(설정하지 않음)을 돌려준다', (_name, raw) => {
    expect(parseDevAllowedOrigins(raw)).toEqual([]);
  });

  it('쉼표로 나누고 앞뒤 공백과 빈 항목을 버린다', () => {
    expect(parseDevAllowedOrigins('a, b ,,c')).toEqual(['a', 'b', 'c']);
  });

  it('IP와 호스트 이름을 그대로 받는다', () => {
    expect(parseDevAllowedOrigins('192.168.0.10,my-mac.local')).toEqual([
      '192.168.0.10',
      'my-mac.local',
    ]);
  });

  it('http://가 붙은 값은 변수 이름과 호스트만 받는다는 안내가 담긴 오류로 거부한다', () => {
    const message = errorMessageOf('http://a');

    expect(message).toContain(VARIABLE_NAME);
    expect(message).toContain('호스트만');
  });

  it('경로가 붙은 값은 변수 이름과 호스트만 받는다는 안내가 담긴 오류로 거부한다', () => {
    const message = errorMessageOf('a/b');

    expect(message).toContain(VARIABLE_NAME);
    expect(message).toContain('호스트만');
  });

  it('여러 값 중 하나만 잘못돼도 거부한다', () => {
    expect(() => parseDevAllowedOrigins('192.168.0.10, https://b')).toThrow(VARIABLE_NAME);
  });
});
