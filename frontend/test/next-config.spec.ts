import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from 'next/constants';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import createNextConfig from '../next.config';

// 명백한 더미 값. 비밀이 아니다. 설정 로드가 요구하는 환경변수를 테스트 안에서 채운다(.env* 미사용).
const INTERNAL_KEY = 'dummy-internal-key-not-secret';
const DUMMY_ENV = {
  API_INTERNAL_URL: 'http://api.dummy.invalid:4000',
  NEXT_PUBLIC_SITE_URL: 'http://site.dummy.invalid:3000',
  INTERNAL_API_KEY: INTERNAL_KEY,
};
const VARIABLE_NAME = 'JBLOG_DEV_ALLOWED_ORIGINS';
const PHONE_HOST = '192.168.0.10';

describe('createNextConfig allowedDevOrigins', () => {
  beforeEach(() => {
    for (const [key, value] of Object.entries(DUMMY_ENV)) vi.stubEnv(key, value);
    vi.stubEnv(VARIABLE_NAME, undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('개발 서버 단계에서 변수에 호스트가 있으면 allowedDevOrigins에 들어간다', () => {
    vi.stubEnv(VARIABLE_NAME, PHONE_HOST);

    expect(createNextConfig(PHASE_DEVELOPMENT_SERVER).allowedDevOrigins).toEqual([PHONE_HOST]);
  });

  it('개발 서버 단계에서 변수가 없으면 allowedDevOrigins를 설정하지 않는다', () => {
    const origins = createNextConfig(PHASE_DEVELOPMENT_SERVER).allowedDevOrigins;

    expect(origins ?? []).toEqual([]);
  });

  it('운영 빌드 단계에서는 변수에 값이 있어도 allowedDevOrigins가 없다', () => {
    vi.stubEnv(VARIABLE_NAME, PHONE_HOST);

    const origins = createNextConfig(PHASE_PRODUCTION_BUILD).allowedDevOrigins;

    expect(origins ?? []).toEqual([]);
  });

  it('개발 서버 단계에서 http://가 붙은 값이면 설정 로드가 오류로 멈춘다', () => {
    vi.stubEnv(VARIABLE_NAME, 'http://192.168.0.10');

    expect(() => createNextConfig(PHASE_DEVELOPMENT_SERVER)).toThrow(VARIABLE_NAME);
  });
});
