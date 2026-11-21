// 통합 테스트 globalSetup: 실행 전체에서 PostgreSQL 컨테이너 1개를 띄우고 접속 URL을 테스트에 넘긴다.
// 마이그레이션은 여기서 적용하지 않는다. 스키마를 아는 test/support/ 헬퍼(backend-dev)가 맡는다.
import { randomBytes } from 'node:crypto';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import {
  INTEGRATION_POSTGRES_IMAGE,
  writeIntegrationDatabaseUrl,
} from './setup-integration-database';

// globalSetup에서 globalThis에 둔 값은 globalTeardown에서만 읽을 수 있다 (Jest 규약).
// 테스트 파일에는 보이지 않으므로 컨테이너 종료 전달에만 쓴다.
const CONTAINER_KEY = Symbol.for('jblog.integration.postgres');

type GlobalWithContainer = typeof globalThis & {
  [CONTAINER_KEY]?: StartedPostgreSqlContainer;
};

// 실행마다 새 비밀번호를 만든다. 고정 비밀번호를 코드에 두지 않기 위해서다 (개요 §6-b).
const PASSWORD_BYTES = 24;

export default async function startIntegrationDatabase(): Promise<void> {
  const container = await new PostgreSqlContainer(INTEGRATION_POSTGRES_IMAGE)
    .withPassword(randomBytes(PASSWORD_BYTES).toString('hex'))
    .start();
  (globalThis as GlobalWithContainer)[CONTAINER_KEY] = container;
  writeIntegrationDatabaseUrl(container.getConnectionUri());
}

export async function stopIntegrationDatabase(): Promise<void> {
  const holder = globalThis as GlobalWithContainer;
  const container = holder[CONTAINER_KEY];
  delete holder[CONTAINER_KEY];
  // 비정상 종료로 남은 컨테이너는 Testcontainers의 Ryuk 컨테이너가 정리한다.
  await container?.stop();
}
