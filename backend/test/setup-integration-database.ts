// 통합 테스트 DB 접속 정보 전달 (globalSetup → 테스트 파일).
//
// globalSetup은 테스트와 다른 컨텍스트에서 실행되어 전역 변수를 테스트에 넘길 수 없다.
// Jest 문서의 방법(process.env 설정)은 설정 모듈 밖 process.env 금지 규칙(개요 §6-b)에 걸리므로,
// 이 checkout의 node_modules/.cache 아래 파일(소유자만 읽기·쓰기)로 넘긴다.
// node_modules는 .gitignore 대상이라 커밋되지 않고, worktree마다 경로가 달라 서로 섞이지 않는다.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// M0-03 infra/docker-compose.yml과 같은 이미지다. 로컬 개발 DB와 테스트 DB의 PostgreSQL 버전이
// 달라 생기는 차이를 막는다. 바꿀 때는 docker-compose.yml과 함께 바꾼다 (움직이는 태그 금지, 개요 §2.1).
export const INTEGRATION_POSTGRES_IMAGE = 'postgres:17.12';

const CONNECTION_FILE = resolve(
  __dirname,
  '../node_modules/.cache/jblog-integration/database.json',
);

// 소유자만 읽고 쓴다. 테스트 전용 일회용 비밀번호지만 다른 사용자에게 보일 이유가 없다.
const OWNER_ONLY_FILE_MODE = 0o600;

interface IntegrationDatabaseConnection {
  databaseUrl: string;
}

export function writeIntegrationDatabaseUrl(databaseUrl: string): void {
  const connection: IntegrationDatabaseConnection = { databaseUrl };
  mkdirSync(dirname(CONNECTION_FILE), { recursive: true });
  writeFileSync(CONNECTION_FILE, JSON.stringify(connection), { mode: OWNER_ONLY_FILE_MODE });
}

/**
 * globalSetup이 띄운 PostgreSQL 컨테이너의 접속 URL을 돌려준다.
 * 통합 테스트(`pnpm --filter @jblog/backend test:integration`) 안에서만 쓸 수 있다.
 * 반환값은 비밀번호를 포함하므로 로그·단정 메시지에 그대로 출력하지 않는다.
 */
export function readIntegrationDatabaseUrl(): string {
  let raw: string;
  try {
    raw = readFileSync(CONNECTION_FILE, 'utf8');
  } catch {
    throw new Error(
      '통합 테스트 DB 접속 정보가 없습니다. `pnpm --filter @jblog/backend test:integration`으로 실행하세요.',
    );
  }
  const connection = JSON.parse(raw) as IntegrationDatabaseConnection;
  return connection.databaseUrl;
}

export function removeIntegrationDatabaseUrl(): void {
  rmSync(CONNECTION_FILE, { force: true });
}
