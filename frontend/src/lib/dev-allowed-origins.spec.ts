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

  it.each(['192.168.0.10', 'my-mac.local', 'localhost', '*.example.local'])(
    '호스트 형식 %s은(는) 그대로 받는다',
    (host) => {
      expect(parseDevAllowedOrigins(host)).toEqual([host]);
    },
  );

  it.each([
    ['포트가 붙은 호스트 이름', 'example.invalid:3000'],
    ['포트가 붙은 IPv4', '192.168.0.10:3000'],
    ['쿼리가 붙은 값', 'example.invalid?x=1'],
    ['해시가 붙은 값', 'example.invalid#f'],
    ['내부 공백이 있는 값', 'exa mple.invalid'],
    ['와일드카드만 있는 값', '*'],
    ['가운데 와일드카드', 'a.*.b'],
    ['하이픈으로 시작하는 값', '-bad.local'],
    ['점이 연속된 값', 'bad..local'],
  ])('%s은(는) 변수 이름이 담긴 오류로 거부한다', (_name, raw) => {
    expect(errorMessageOf(raw)).toContain(VARIABLE_NAME);
  });

  it.each(['[::1]', '::1'])(
    'IPv6 %s은(는) IPv4나 호스트 이름만 받는다는 안내가 담긴 오류로 거부한다',
    (raw) => {
      const message = errorMessageOf(raw);

      expect(message).toContain(VARIABLE_NAME);
      expect(message).toContain('IPv4나 호스트 이름');
    },
  );
});
