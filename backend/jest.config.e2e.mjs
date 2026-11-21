// e2e 설정: test/**/*.e2e-spec.ts. Supertest가 앱을 메모리에서 띄우므로 포트를 고정하지 않는다.
import { createBaseConfig } from './jest.config.base.mjs';

export default {
  ...createBaseConfig(),
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
};
