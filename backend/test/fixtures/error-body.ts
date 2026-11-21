// 전역 에러 필터의 응답 형식(백엔드 §4.1) 단정. 여러 e2e·통합 테스트가 같은 기준을 쓴다.

export interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  path: string;
  timestamp: string;
}

export const ERROR_BODY_KEYS = ['code', 'message', 'path', 'statusCode', 'timestamp'];
const ISO_8601_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

export function expectErrorShape(
  body: ErrorBody,
  expected: { statusCode: number; code: string; path: string },
): void {
  expect(Object.keys(body).sort()).toEqual(ERROR_BODY_KEYS);
  expect(body.statusCode).toBe(expected.statusCode);
  expect(body.code).toBe(expected.code);
  expect(body.path).toBe(expected.path);
  expect(typeof body.message).toBe('string');
  expect(body.timestamp).toMatch(ISO_8601_UTC);
  expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
}
