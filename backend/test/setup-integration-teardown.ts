// 통합 테스트 globalTeardown: globalSetup이 띄운 컨테이너를 멈추고 접속 정보 파일을 지운다.
// Jest는 globalTeardown 모듈의 default export를 실행하므로 파일을 따로 둔다.
import { stopIntegrationDatabase } from './setup-integration';
import { removeIntegrationDatabaseUrl } from './setup-integration-database';

export default async function teardownIntegrationDatabase(): Promise<void> {
  try {
    await stopIntegrationDatabase();
  } finally {
    removeIntegrationDatabaseUrl();
  }
}
