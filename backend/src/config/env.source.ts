// process.env를 읽는 유일한 곳. 나머지 코드는 검증된 AppEnv만 받는다.
export function readProcessEnv(): Record<string, unknown> {
  return { ...process.env };
}
