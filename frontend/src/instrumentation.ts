// 서버 인스턴스가 시작될 때 한 번 실행되고, 끝나야 요청을 받는다 (Next 문서: instrumentation).
// 여기서 필수 서버 설정을 검증해 INTERNAL_API_KEY가 없는 운영 서버가 기동에 실패하게 한다 (M2-E 규약 4).
// 빌드는 키 없이 통과해야 하므로 단계 구분은 verifyRuntimeEnv가 맡는다.
export async function register(): Promise<void> {
  const { verifyRuntimeEnv } = await import('./lib/env');
  verifyRuntimeEnv();
}
