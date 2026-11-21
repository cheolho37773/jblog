// 통합 테스트 설정: test/**/*.int-spec.ts. Testcontainers로 실제 PostgreSQL에 붙으므로 Docker가 필요하다.
// 단위(jest.config.mjs)·e2e(jest.config.e2e.mjs)와 testMatch가 겹치지 않아 그쪽 실행에는 들어가지 않는다.
import { createBaseConfig } from './jest.config.base.mjs';

// 컨테이너 기동은 globalSetup에서 끝나므로 테스트 하나의 시간에는 들어가지 않는다.
// 마이그레이션·seed처럼 실제 DB 왕복이 많은 테스트를 고려해 기본 5초보다 넉넉하게 둔다.
const INTEGRATION_TEST_TIMEOUT_MS = 60_000;

export default {
  ...createBaseConfig(),
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.int-spec.ts'],
  testTimeout: INTEGRATION_TEST_TIMEOUT_MS,
  // 컨테이너(DB) 하나를 모든 테스트 파일이 함께 쓰므로 파일을 직렬로 실행해 서로의 데이터를 건드리지 않게 한다.
  maxWorkers: 1,
  globalSetup: '<rootDir>/test/setup-integration.ts',
  globalTeardown: '<rootDir>/test/setup-integration-teardown.ts',
};
