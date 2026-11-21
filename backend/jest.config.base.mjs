// 단위·e2e가 공유하는 Jest 설정. 변환기는 ts-jest(타입 검사 + emitDecoratorMetadata 처리).
// backend/.env는 읽지 않는다: 테스트가 필요한 환경변수는 코드에서 더미 값으로 넣는다.
export function createBaseConfig() {
  return {
    testEnvironment: 'node',
    moduleFileExtensions: ['js', 'json', 'ts'],
    transform: {
      '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
    },
    setupFiles: ['<rootDir>/test/setup.ts'],
    clearMocks: true,
  };
}
