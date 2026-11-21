// 테스트 전용 더미 DATABASE_URL. 실제 접속 정보가 아니며, 아무 DB에도 연결되지 않는다(개요 §6-b 규칙 5).
//
// 사용자·비밀번호는 URL 객체로 붙인다. 코드에 `스킴://이름:값@` 형태를 그대로 쓰면
// 커밋 전 비밀정보 검사에 걸리고, 진짜 접속 문자열과 구분하기도 어렵다.

// 1번 포트는 쓰는 서비스가 없어 연결이 즉시 거부된다. "DB에 연결할 수 없음"을 빠르게 재현한다.
export const UNREACHABLE_DATABASE = {
  host: '127.0.0.1',
  port: '1',
  database: 'jblog_dummy_db',
  user: 'dummy_user_7c1e',
  password: 'dummy-password-5d2b',
} as const;

export function buildUnreachableDatabaseUrl(): string {
  const { host, port, database, user, password } = UNREACHABLE_DATABASE;
  const url = new URL(`postgresql://${host}:${port}/${database}`);
  url.username = user;
  url.password = password;
  return url.toString();
}
