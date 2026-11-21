import { describe, expect, it } from 'vitest';
import { PUBLIC_ENV_KEYS, findSecretLikePublicKeys, parseEnv } from './env.schema';

// 명백한 더미 URL. 비밀값이 아니다.
const API_URL = 'http://api.dummy.invalid:4000';
const SITE_URL = 'http://site.dummy.invalid:3000';
const NOT_A_URL = 'not-a-url-dummy';

const validRaw = {
  API_INTERNAL_URL: API_URL,
  NEXT_PUBLIC_SITE_URL: SITE_URL,
};

function parseErrorMessage(raw: Record<string, unknown>): string {
  try {
    parseEnv(raw);
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error('parseEnv가 오류를 던지지 않았다');
}

describe('parseEnv', () => {
  it('올바른 값이면 서버 값과 공개 값을 나눠 돌려준다', () => {
    const parsed = parseEnv(validRaw);

    expect(parsed.server.API_INTERNAL_URL).toBe(API_URL);
    expect(parsed.public.NEXT_PUBLIC_SITE_URL).toBe(SITE_URL);
  });

  it('공개 값 객체에는 NEXT_PUBLIC_ 키만 담긴다', () => {
    const parsed = parseEnv({ ...validRaw, UNRELATED_DUMMY: 'x' });

    const keys = Object.keys(parsed.public);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.every((key) => key.startsWith('NEXT_PUBLIC_'))).toBe(true);
    expect(Object.keys(parsed.server)).not.toContain('NEXT_PUBLIC_SITE_URL');
  });

  it.each(['API_INTERNAL_URL', 'NEXT_PUBLIC_SITE_URL'])(
    '%s가 없으면 변수 이름을 담은 오류로 실패한다',
    (name) => {
      const raw: Record<string, unknown> = { ...validRaw };
      delete raw[name];

      expect(parseErrorMessage(raw)).toContain(name);
    },
  );

  it.each(['API_INTERNAL_URL', 'NEXT_PUBLIC_SITE_URL'])(
    '%s가 URL이 아니면 변수 이름만 담고 값은 담지 않은 오류로 실패한다',
    (name) => {
      const message = parseErrorMessage({ ...validRaw, [name]: NOT_A_URL });

      expect(message).toContain(name);
      expect(message).not.toContain(NOT_A_URL);
    },
  );

  it('두 변수가 모두 잘못되면 오류에 두 이름이 모두 담긴다', () => {
    const message = parseErrorMessage({});

    expect(message).toContain('API_INTERNAL_URL');
    expect(message).toContain('NEXT_PUBLIC_SITE_URL');
  });

  it('빈 문자열은 기본값 없이 거부한다', () => {
    expect(parseErrorMessage({ ...validRaw, API_INTERNAL_URL: '' })).toContain('API_INTERNAL_URL');
  });
});

describe('findSecretLikePublicKeys', () => {
  it.each([
    'NEXT_PUBLIC_JWT_SECRET',
    'NEXT_PUBLIC_API_KEY',
    'NEXT_PUBLIC_DATABASE_URL',
    'NEXT_PUBLIC_ACCESS_TOKEN',
    'NEXT_PUBLIC_ADMIN_PASSWORD',
    'NEXT_PUBLIC_VISITOR_HASH_SALT',
    'NEXT_PUBLIC_JWT_ACCESS_TTL',
  ])('비밀값처럼 보이는 공개 변수 이름 %s를 찾아낸다', (name) => {
    expect(findSecretLikePublicKeys([name])).toEqual([name]);
  });

  it('안전한 이름은 통과시키고 위험한 이름만 골라낸다', () => {
    const safe = 'NEXT_PUBLIC_SITE_URL';
    const risky = 'NEXT_PUBLIC_INTERNAL_API_KEY';

    expect(findSecretLikePublicKeys([safe, risky])).toEqual([risky]);
  });

  it('현재 공개 변수 목록에는 비밀값 같은 이름이 없다', () => {
    expect(PUBLIC_ENV_KEYS).toContain('NEXT_PUBLIC_SITE_URL');
    expect(findSecretLikePublicKeys(PUBLIC_ENV_KEYS)).toEqual([]);
  });
});
