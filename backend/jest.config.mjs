// 단위 테스트 설정: src/**/*.spec.ts. e2e는 jest.config.e2e.mjs (소유권상 둘 다 backend/jest.config.* 이름).
import { createBaseConfig } from './jest.config.base.mjs';

export default {
  ...createBaseConfig(),
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
};
