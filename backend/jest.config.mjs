// 단위 테스트 설정: src/**/*.spec.ts·*.unit.test.ts. e2e는 jest.config.e2e.mjs (소유권상 둘 다 backend/jest.config.* 이름).
import { createBaseConfig } from './jest.config.base.mjs';

export default {
  ...createBaseConfig(),
  rootDir: '.',
  // *.unit.test.ts는 구현 에이전트가 쓰는 단위 테스트 이름(협업 §4.3)이다.
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/src/**/*.unit.test.ts'],
};
