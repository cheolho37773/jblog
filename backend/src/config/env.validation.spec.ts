import { validateEnv } from './env.validation';

const VALID_ENV = { NODE_ENV: 'development', API_PORT: '4000' };

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
      'NODE_ENV=%s 와 API_PORT=4000 은 통과한다',
      (nodeEnv) => {
        expect(() => validateEnv({ NODE_ENV: nodeEnv, API_PORT: '4000' })).not.toThrow();
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
    it.each(['NODE_ENV', 'API_PORT'])('%s 이 없으면 거부하고 메시지에 변수 이름이 있다', (name) => {
      expect(errorMessageOf(envWithout(name))).toContain(name);
    });

    it('둘 다 없으면 메시지에 두 변수 이름이 모두 있다', () => {
      const message = errorMessageOf({});

      expect(message).toContain('NODE_ENV');
      expect(message).toContain('API_PORT');
    });

    it.each(['abc', '0', '65536', '-1', '40.5', ''])('API_PORT=%j 는 거부한다', (port) => {
      expect(errorMessageOf({ ...VALID_ENV, API_PORT: port })).toContain('API_PORT');
    });

    it('NODE_ENV=staging 은 거부한다', () => {
      expect(errorMessageOf({ ...VALID_ENV, NODE_ENV: 'staging' })).toContain('NODE_ENV');
    });

    it('잘못된 값은 에러 메시지에 출력하지 않는다', () => {
      const message = errorMessageOf({ NODE_ENV: LEAK_CHECK_VALUE, API_PORT: LEAK_CHECK_VALUE });

      expect(message).not.toContain(LEAK_CHECK_VALUE);
    });

    it('기본값을 채우지 않는다: 빈 객체는 통과하지 못한다', () => {
      expect(() => validateEnv({})).toThrow(Error);
    });
  });
});
