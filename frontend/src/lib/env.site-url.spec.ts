import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.schema';

// Codex r2 #1 회귀: NEXT_PUBLIC_SITE_URL은 오리진만 받는다(경로 없음 또는 `/` 하나, 쿼리·해시 없음).
// 이 사이트는 도메인 루트에서만 서비스한다. 경로가 붙은 주소는 metadataBase(경로 유지)와 new URL('/blog/..', base)(경로 버림)가
// 서로 다른 주소를 만들어 canonical과 복사 링크가 어긋나므로 설정 단계에서 막는다. 명백한 더미 값만 쓴다.
const API_URL = 'http://api.dummy.invalid:4000';
const INTERNAL_KEY = 'dummy-internal-key-not-secret';
const rawWith = (siteUrl: string) => ({
  API_INTERNAL_URL: API_URL,
  NEXT_PUBLIC_SITE_URL: siteUrl,
  INTERNAL_API_KEY: INTERNAL_KEY,
});

function errorMessageOf(siteUrl: string): string {
  try {
    parseEnv(rawWith(siteUrl));
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error(`${siteUrl}가 거부되지 않았다`);
}

describe('NEXT_PUBLIC_SITE_URL은 오리진만 받는다', () => {
  it.each(['https://example.com', 'https://example.com/', 'http://localhost:3000'])(
    '%s는 받는다',
    (siteUrl) => {
      expect(parseEnv(rawWith(siteUrl)).public.NEXT_PUBLIC_SITE_URL).toBe(siteUrl);
    },
  );

  it.each([
    'https://example.com/base',
    'https://example.com/base/',
    'https://example.com/?a=1',
    'https://example.com/#x',
  ])('%s는 거부한다', (siteUrl) => {
    expect(() => parseEnv(rawWith(siteUrl))).toThrow();
  });

  it.each(['https://example.com/base', 'https://example.com/?a=1'])(
    '거부 메시지에 변수 이름과 "오리진" 취지가 드러난다: %s',
    (siteUrl) => {
      const message = errorMessageOf(siteUrl);
      expect(message).toContain('NEXT_PUBLIC_SITE_URL');
      expect(message).toContain('오리진');
    },
  );
});
