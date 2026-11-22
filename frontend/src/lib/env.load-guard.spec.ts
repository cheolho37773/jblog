import { afterEach, describe, expect, it, vi } from 'vitest';

// 키 이름만 검사한다. 값은 어디에도 쓰지 않는다 (개요 §6-b 규칙 3).
const SAFE_KEY = 'NEXT_PUBLIC_SITE_URL';

async function loadEnvSchema() {
  return import('./env.schema');
}

// 공개 스키마 모듈을 주어진 키로 바꿔 넣는다. 사례끼리 오염되지 않게 doMock + resetModules를 쓴다.
async function mockPublicSchemaKeys(keys: string[]) {
  vi.resetModules();
  vi.doMock('./env.public-schema', async () => {
    const { z } = await import('zod');
    const shape = Object.fromEntries(keys.map((key) => [key, z.string()]));
    return { publicSchema: z.object(shape) };
  });
}

afterEach(() => {
  vi.doUnmock('./env.public-schema');
  vi.resetModules();
});

describe('assertPublicKeysSafe', () => {
  it('안전한 이름 목록은 오류 없이 통과한다', async () => {
    const { assertPublicKeysSafe } = await loadEnvSchema();

    expect(() => assertPublicKeysSafe([SAFE_KEY, 'NEXT_PUBLIC_APP_NAME'])).not.toThrow();
  });

  it.each(['NEXT_PUBLIC_API_KEY', 'NEXT_PUBLIC_JWT_SECRET', 'NEXT_PUBLIC_DATABASE_URL'])(
    '비밀값처럼 보이는 이름 %s가 있으면 그 이름을 담은 오류를 던진다',
    async (name) => {
      const { assertPublicKeysSafe } = await loadEnvSchema();

      expect(() => assertPublicKeysSafe([SAFE_KEY, name])).toThrow(name);
    },
  );

  it('위험한 이름이 여러 개면 모두 오류 메시지에 담고 안전한 이름은 담지 않는다', async () => {
    const { assertPublicKeysSafe } = await loadEnvSchema();

    expect(() =>
      assertPublicKeysSafe([SAFE_KEY, 'NEXT_PUBLIC_API_KEY', 'NEXT_PUBLIC_JWT_SECRET']),
    ).toThrow(/NEXT_PUBLIC_API_KEY.*NEXT_PUBLIC_JWT_SECRET/);
    expect(() => assertPublicKeysSafe([SAFE_KEY, 'NEXT_PUBLIC_API_KEY'])).not.toThrow(SAFE_KEY);
  });
});

describe('env.schema 모듈 로드', () => {
  it('비밀값처럼 보이는 공개 변수가 정의되면 로드가 실패하고 메시지에 그 이름이 있다', async () => {
    await mockPublicSchemaKeys([SAFE_KEY, 'NEXT_PUBLIC_API_KEY']);

    await expect(loadEnvSchema()).rejects.toThrow('NEXT_PUBLIC_API_KEY');
  });

  it('로드 실패 메시지에는 안전한 이름이 섞이지 않는다', async () => {
    await mockPublicSchemaKeys([SAFE_KEY, 'NEXT_PUBLIC_JWT_SECRET']);

    await expect(loadEnvSchema()).rejects.not.toThrow(SAFE_KEY);
  });

  it('안전한 공개 스키마로는 로드에 성공하고 공개 키 목록이 스키마를 따른다', async () => {
    await mockPublicSchemaKeys([SAFE_KEY, 'NEXT_PUBLIC_APP_NAME']);

    const loaded = await loadEnvSchema();

    expect(loaded.PUBLIC_ENV_KEYS).toEqual([SAFE_KEY, 'NEXT_PUBLIC_APP_NAME']);
  });

  it('앞선 위험한 모킹이 다음 사례에 남지 않는다', async () => {
    await mockPublicSchemaKeys([SAFE_KEY, 'NEXT_PUBLIC_API_KEY']);
    await expect(loadEnvSchema()).rejects.toThrow('NEXT_PUBLIC_API_KEY');

    await mockPublicSchemaKeys([SAFE_KEY]);

    await expect(loadEnvSchema()).resolves.toBeDefined();
  });
});
