import { validateEnv } from './env.validation';

// 명백한 더미 접속 URL. 닫힌 포트(1)를 가리키며 사용자·비밀번호가 없다.
const DUMMY_DATABASE_URL = 'postgresql://127.0.0.1:1/jblog_dummy_db';
const VALID_ENV = { NODE_ENV: 'development', API_PORT: '4000', DATABASE_URL: DUMMY_DATABASE_URL };

// 값이 에러 메시지로 새지 않는지 확인하기 위해 눈에 띄는 더미 값을 쓴다.
const LEAK_CHECK_VALUE = 'leak-check-9f3a';

function envWithout(name: string): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...VALID_ENV };
  delete copy[name];
  return copy;
}

function errorMessageOf(raw: Record<string, unknown>): string {
  try {
    validateEnv(raw);
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error('validateEnv가 던지지 않았다');
}

describe('validateEnv (환경변수 검증)', () => {
  describe('정상 값', () => {
    it.each(['development', 'test', 'production'])(
      'NODE_ENV=%s 와 API_PORT=4000, 더미 DATABASE_URL 은 통과한다',
      (nodeEnv) => {
        expect(() => validateEnv({ ...VALID_ENV, NODE_ENV: nodeEnv })).not.toThrow();
      },
    );

    it.each(['1', '65535'])('API_PORT 경계값 %s 은 통과한다', (port) => {
      expect(() => validateEnv({ ...VALID_ENV, API_PORT: port })).not.toThrow();
    });

    it('숫자로 넘긴 API_PORT 도 통과한다', () => {
      expect(() => validateEnv({ ...VALID_ENV, API_PORT: 4000 })).not.toThrow();
    });

    it('검증 대상이 아닌 다른 변수가 섞여 있어도 통과한다', () => {
      expect(() => validateEnv({ ...VALID_ENV, PATH: '/usr/bin' })).not.toThrow();
    });
  });

  describe('거부', () => {
    it.each(['NODE_ENV', 'API_PORT', 'DATABASE_URL'])(
      '%s 이 없으면 거부하고 메시지에 변수 이름이 있다',
      (name) => {
        expect(errorMessageOf(envWithout(name))).toContain(name);
      },
    );

    it('모두 없으면 메시지에 모든 필수 변수 이름이 있다', () => {
      const message = errorMessageOf({});

      expect(message).toContain('NODE_ENV');
      expect(message).toContain('API_PORT');
      expect(message).toContain('DATABASE_URL');
    });

    it.each(['abc', '0', '65536', '-1', '40.5', ''])('API_PORT=%j 는 거부한다', (port) => {
      expect(errorMessageOf({ ...VALID_ENV, API_PORT: port })).toContain('API_PORT');
    });

    it('NODE_ENV=staging 은 거부한다', () => {
      expect(errorMessageOf({ ...VALID_ENV, NODE_ENV: 'staging' })).toContain('NODE_ENV');
    });

    it('잘못된 값은 에러 메시지에 출력하지 않는다', () => {
      const message = errorMessageOf({
        NODE_ENV: LEAK_CHECK_VALUE,
        API_PORT: LEAK_CHECK_VALUE,
        DATABASE_URL: LEAK_CHECK_VALUE,
      });

      expect(message).not.toContain(LEAK_CHECK_VALUE);
    });

    it('기본값을 채우지 않는다: 빈 객체는 통과하지 못한다', () => {
      expect(() => validateEnv({})).toThrow(Error);
    });
  });

  describe('DATABASE_URL (M0-06)', () => {
    // 사용자·비밀번호는 URL 객체로 붙인다. 소스에 `스킴://이름:값@` 형태를 쓰지 않기 위해서다.
    function urlWithDummyCredentials(base: string): string {
      const url = new URL(base);
      url.username = 'dummy_user_7c1e';
      url.password = LEAK_CHECK_VALUE;
      return url.toString();
    }

    it.each([
      ['postgresql 스킴', 'postgresql://localhost:5432/jblog'],
      ['postgres 스킴(Testcontainers 형식)', 'postgres://127.0.0.1:55432/test'],
      ['쿼리 파라미터 포함', 'postgresql://localhost:5432/jblog?schema=public'],
    ])('%s URL 은 통과한다', (_caseName, databaseUrl) => {
      expect(() => validateEnv({ ...VALID_ENV, DATABASE_URL: databaseUrl })).not.toThrow();
    });

    it('사용자·비밀번호가 들어간 URL 도 통과한다', () => {
      const databaseUrl = urlWithDummyCredentials('postgresql://localhost:5432/jblog');

      expect(() => validateEnv({ ...VALID_ENV, DATABASE_URL: databaseUrl })).not.toThrow();
    });

    it('검증 결과에 DATABASE_URL 을 그대로 싣는다 (기본값으로 바꾸지 않는다)', () => {
      expect(validateEnv(VALID_ENV)).toMatchObject({ DATABASE_URL: DUMMY_DATABASE_URL });
    });

    it.each(['', 'not-a-url', 12345])(
      'DATABASE_URL=%j 는 거부하고 메시지에 변수 이름이 있다',
      (databaseUrl) => {
        expect(errorMessageOf({ ...VALID_ENV, DATABASE_URL: databaseUrl })).toContain(
          'DATABASE_URL',
        );
      },
    );

    it('형식이 틀린 DATABASE_URL 값은 메시지에 출력하지 않는다', () => {
      const message = errorMessageOf({ ...VALID_ENV, DATABASE_URL: LEAK_CHECK_VALUE });

      expect(message).toContain('DATABASE_URL');
      expect(message.includes(LEAK_CHECK_VALUE)).toBe(false);
    });

    it('다른 변수가 틀려 실패해도 올바른 DATABASE_URL 의 비밀번호를 메시지에 넣지 않는다', () => {
      const databaseUrl = urlWithDummyCredentials('postgresql://localhost:5432/jblog');

      const message = errorMessageOf({
        ...VALID_ENV,
        NODE_ENV: 'staging',
        DATABASE_URL: databaseUrl,
      });

      expect(message.includes(LEAK_CHECK_VALUE)).toBe(false);
    });
  });
});
